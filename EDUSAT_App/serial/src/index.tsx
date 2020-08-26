/*  REQUIRED LIBRARIES  */
import io from "socket.io-client";
import SerialPort from "serialport";
import { createStore } from "redux";
import {
    SensorStatus,
    ComPort,
    State,
    Action,
    UpdateSensorData,
    UpdateComPort,
} from "./interfaces";

/*  SOCKET SETUP  */
const socket = io("http://192.168.0.25:3000/"); //SocketIO client

/*      HANDLE SOCKET EVENTS    */
//Handle connections
function setupSocketEvents(port: SerialPort): SerialPort {
    socket.on("connect", () => {
        console.log("Connected to server!");
        socket.send("Hello from client!");

        socket.on("command", function (data: string) {
            //Process is: RX Command -> serialWrite to MCU -> UpdateDrivetrainData

            sendCommands(data, port);
        });

        socket.on("sensorRequest", function () {
            //Process is: RX req -> Query MCU -> Record MCU -> UpdateSensorData -> emit update
            const x = sendSensorData(store.getState().sensor, socket);
            x();
        });
    });
    //Log reconnect attempts
    socket.on("reconnect", (e: number) => {
        console.log("Reconnected to server!");
        socket.send("Number of reconnects: " + e);
    });
    return port;
}

//Send robot status information
type SEND = () => void; //IO type
//Send sensor information
const sendSensorData = (sensor: SensorStatus, socket: SocketIOClient.Socket): SEND => {
    //Instance of IO type
    const send = () => socket.emit("sensorResponse", sensor);
    return send;
};

/*    APP EVENT HANDLERS    */
//Redux dispatch store setup
//var serialPort = new SerialPort("NO CONNECTION");
const initial_State: State = {
    sensor: {
        selection: { heartRate: false, temperature: false },
        values: { heartRate: 0, temperature: 0 },
    },
};
const store = createStore(reducer);

//Subscribe to store to get state updates and send them to the server
const unsubscribe = store.subscribe(() => {
    const x = sendSensorData(store.getState().sensor, socket);
    x();
}); //When state updates can subscribe the store here

setInterval(sendSensorData(store.getState().sensor, socket), 1000 / 30);

//update game data action creator, returns a Action
function UpdateDrivetrainData(drive: DrivetrainStatus): UpdateDrivetrainData {
    return {
        axes: { x: drive.axes.x, y: drive.axes.y, om: drive.axes.om },
        toggle: {
            start: drive.toggle.start,
            stop: drive.toggle.stop,
        },
        type: "UpdateDrivetrainData",
    };
}

//update sensor data action creator, returns a Action
function UpdateSensorData(sensor: SensorStatus): UpdateSensorData {
    return {
        selection: {
            heartRate: sensor.selection.heartRate,
            temperature: sensor.selection.temperature,
        },
        values: { heartRate: sensor.values.heartRate, temperature: sensor.values.temperature },
        type: "UpdateSensorData",
    };
}

//update robot data action creator, returns a Action
function UpdateRobotData(robot: RobotStatus): UpdateRobotData {
    return {
        connected: robot.connected,
        voltage: robot.voltage,
        type: "UpdateRobotData",
    };
}

//update comport with MCU action creator, returns a Action
function UpdateComPort(port: SerialPort): UpdateComPort {
    return {
        port: port,
        type: "UpdateComPort",
    };
}

//Reduce the action that was dispatched
function reducer(state: State = initial_State, action: Action): State {
    if (action.type === "UpdateSensorData") {
        const newState: State = {
            ...state,
            sensor: {
                ...state.sensor,
                selection: action.selection,
                values: { ...action.values, temperature: Math.random() * 5 },
            },
        };
        return newState;
    } else if (action.type === "UpdateComPort") {
        const newState: State = {
            ...state,
            port: action.port,
        };
        console.log("COMPORT UPDATED");
        console.log(action.port.path);
        return newState;
    } else return state;
}

/*      SETUP SERIAL PORT      */
const HEADER = "H";
const DELIMITER = ",";
const FOOTER = "F";
const MAX_DATA_SIZE = 100;

///Find the serial port with a Arduino connected:
//Using promises because that is what SerialPort.list() returns
//This ensures that we catch any errors if no ports are returned
//Using SerialPort.list() prevents us from having to hardcode the path
SerialPort.list()
    .then((ports) => {
        ports.forEach((port) => {
            if (port.path) {
                var curPort = new SerialPort(port.path, { autoOpen: false });
                store.dispatch(UpdateComPort(curPort));
                console.log(curPort.path);
                return curPort;
            }
        });
        console.log("we have dispatched");
    })
    .then(() => {
        var port: SerialPort | undefined = store.getState().port;
        //console.log("in then2");
        //console.log(port)
        return port;
    })
    .then((port) => {
        //console.log(port);
        return makeSerialPort(port ? port.path : "PORT DNE");
    })
    .then((port) => {
        //console.log("in then4");
        return portReading(port);
    })
    .then((port) => {
        setupSocketEvents(port);
        console.log("in then5");
        return port;
    })
    .catch((err) => {
        console.log("we have caught a port error", err);
    });

/*      SERIAL PORT FUNCTIONS      */
function makeSerialPort(path: string): SerialPort {
    const port = new SerialPort(path, {
        autoOpen: true,
        baudRate: 9600,
    });
    console.log("we made a port");
    return port;
}

function portReading(port: SerialPort): SerialPort {
    //Setup serial parser:
    const Readline = SerialPort.parsers.Readline;
    const parser = port.pipe(new Readline({ delimiter: "\n" }));
    var currentData = "";

    /*      HANDLE SERIAL EVENTS    */
    //Read serial data coming from MCU
    port.on("open", function () {
        console.log("Serial port is open!");

        var dataIndex = 0;

        parser.on("data", function (data: any) {
            let newSensorData: SensorStatus = {
                voltage: [0, 0, 0, 0, 0, 0],
                current: [0, 0, 0, 0, 0, 0],
                temperature: [0, 0, 0, 0],
            };

            //Check if the received data has a valid format that we can read and then parse it
            if (data[0] === HEADER) {
                //Cycle through valid data and assign it to the correct state variable
                for (var i = 1; i < data.length; i++) {
                    switch (data[i]) {
                        case DELIMITER: {
                            switch (dataIndex) {
                                case 0:
                                    newSensorData.voltage[i] = +currentData;
                                    break;
                                case 1:
                                    newSensorData.current[i] = +currentData;
                                    break;
                                case 2:
                                    newSensorData.temperature[i] = +currentData;
                                    break;
                                default:
                                    break;
                            }
                            dataIndex++;
                            currentData = "";
                            break;
                        }
                        case FOOTER: {
                            dataIndex = 0;
                            console.log(newSensorData);
                            store.dispatch(UpdateSensorData(newSensorData));
                            return;
                        }
                        default: {
                            currentData += data[i];
                            break;
                        }
                    }
                }
            }
        });
    });
    return port;
}

//TODO:
//Send serial data over serial interface to MCU
function sendCommands(command: string, port: SerialPort) {
    //If the port is open write data
    if (port.isOpen) {
        8;
        port.write("c" + command);
        port.write("\n");
    } else {
        return;
    }
}
