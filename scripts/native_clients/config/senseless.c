#include <haltestelle.h>
#include <stdio.h>

char msg_type_sensor[100];
char msg_type_actor[100];
void hs_startup() {
    snprintf(msg_type_sensor, sizeof(msg_type_sensor), "sensor.senseless.%s", hs_designation());
    snprintf(msg_type_actor,  sizeof(msg_type_actor), "act.senseless.%s", hs_designation());
}

void hs_shutdown() {
	serial_write("p");
}

void do_serial(char* msg) {
	if(msg[0] == 'D' && msg[1] == 'H' && msg[2] == 'T') {
        network_write("{ \"type\":\"sensor.senseless.%s\", \"msg\": { \"c\":\"%s\" } }\n", hs_designation(), msg);
    } else if(msg[0] == 'P' && msg[1] == 'I' && msg[2] == 'R') {
        network_write("{ \"type\":\"sensor.senseless.%s\", \"msg\": { \"sensor\":\"motion\", \"status\":\"triggered\" } }\n", hs_designation());
    }
}

void execute_command(const char* msg) {
    if(strcmp("refresh_temp", msg) == 0) {
        serial_write("t");
    } else if(strcmp("lamp_off", msg) == 0) {
        serial_write("l");
    } else if(strcmp("lamp_on", msg) == 0) {
        serial_write("L");
    } else if(strcmp("enable_pir", msg) == 0) {
        serial_write("P");
    } else if(strcmp("disable_pir", msg) == 0) {
        serial_write("p");
    }
}

void do_network(JSON_Value* json, char* msg) {
    if(json_value_get_type(json) == JSONObject) {
        JSON_Object* obj = json_value_get_object(json);
        const char* msgtype = json_object_dotget_string(obj, "type");

        if(strcmp(msgtype, msg_type_sensor) == 0 || strcmp(msgtype, msg_type_actor) == 0) {
            const char* command = json_object_dotget_string(obj, "msg.command");
            execute_command(command);            
        }
    }
}
