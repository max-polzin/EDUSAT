// ====================
// Libraries
// ====================
#include "SystemStatus.h"

// =================
// SystemStatus Class
// =================
SystemStatus::SystemStatus(): mux(MUX_SIZE, MUX_PIN_1, MUX_PIN_2, MUX_PIN_3, MUX_PIN_4, MUX_PIN_D)
{
    for (int i = 0; i < 6; i++) {
      //test comment
        voltages[i].setNum(i);
        voltages[i].setType('v');
        currents[i].setNum(i);
        currents[i].setType('c'); 
        if (i < 4) {
            temperatures[i].setNum(i);
            temperatures[i].setType('t');
        }
    }
    mode = true;
    //mux.readMux(1);
}

void SystemStatus::setMode(bool cmd)
{
    mode = cmd;
}

Sensor SystemStatus::getVoltages(int i) {
  return voltages[i];
}

Sensor SystemStatus::getCurrents(int i) {
  return currents[i];
}

Sensor SystemStatus::getTemperatures(int i) {
  return temperatures[i];
}

void SystemStatus::updateStatus()
{
    v = 0; //Voltage, Current, Temperature counters
    t=0;
    j=0;
    //Cycle through all 16 channels and read the values for each corresponding sensor (i.e. Channel 4 is Voltage sensor 2)
    for (int i = 0; i < MUX_SIZE; i++) {
        if (i == 15 || i == 14 || i == 13 || i == 12 || i == 11 || i == 10) { 
            voltages[v].voltageCalculator(mux.readMux(i), v);
            v++;
        }
        else if (i == 9 || i == 8 || i == 7 || i == 6 || i == 5 || i == 4) { 
            currents[j].currentCalculator(mux.readMux(i), j);
            j++;
        }
        else if (i == 3 || i == 2 || i == 1 || i == 0) { 
            temperatures[t].temperatureCalculator(mux.readMux(i), t);
            t++;
        }
        delay(50);
    }
}

void SystemStatus::sendTelemtry()
{
     Serial.print(HEADER);
     Serial.print(voltages[0].getType());
    for (int i = 0; i < V_SENSE_SIZE; i++)
    {
        Serial.print(i);
        Serial.print('-');
        Serial.print(voltages[i].getValue());
        Serial.print(DELIMITER);
    }
    Serial.print(currents[0].getType());
    for (int i = 0; i < I_SENSE_SIZE; i++)
    {
        Serial.print(i);
        Serial.print('-');
        Serial.print(currents[i].getValue());
        Serial.print(DELIMITER);
    }
    Serial.print(temperatures[0].getType());
    for (int i = 0; i < T_SENSE_SIZE; i++)
    {
        Serial.print(i);
        Serial.print('-');
        Serial.print(temperatures[i].getValue());
        Serial.print(DELIMITER);
    }
    Serial.println(FOOTER);
}
