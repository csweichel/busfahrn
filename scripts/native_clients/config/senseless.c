#include <haltestelle.h>

void hs_startup() {

}

void hs_shutdown() {
	serial_write("p");
}

void do_serial(char* msg) {
	if(msg[0] == 'D' && msg[1] == 'H' && msg[2] == 'T') {
        network_write("{ \"type\":\"sensors.senseless.%s\", \"msg\": { \"c\":\"%s\" } }", hs_designation(), msg);
    } else if(msg[0] == 'P' && msg[1] == 'I' && msg[2] == 'R') {
        network_write("{ \"type\":\"sensors.senseless.%s\", \"msg\": { \"sensor\":\"motion\", \"status\":\"triggered\" } }", hs_designation());
    }
}

void do_network(char* msg) {
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
