#include <haltestelle.h>
#include <string.h>
#include <stdio.h>

void hs_startup() {
    printf("[STARTUP] complete\n");
}

void hs_shutdown() {
}

void do_serial(char* msg) {
    if(strlen(msg) > 0) {
        network_write("{ \"type\":\"sensor.heating.central\", \"msg\": { \"temperature\":\"%s\" } }\n", msg);
    }
}

void do_network(JSON_Value* json, char* msg) {
    if(json_value_get_type(json) == JSONObject) {
        JSON_Object* obj = json_value_get_object(json);
        
        if(strcmp(json_object_dotget_string(obj, "type"), "act.heating.central") == 0) {
            if(json_object_dotget_value(obj, "msg.level") != 0) {
                int heatingLevel = 9 - (int)json_object_dotget_number(obj, "msg.level");
                printf("ACTING on cmd: %d\n", heatingLevel);

                if(heatingLevel > 9) heatingLevel = 9;
                if(heatingLevel < 0) heatingLevel = 0;
                printf("Set level %d\n", heatingLevel);
                serial_write("%d", heatingLevel);
            }
        }
    }
}
