
#ifndef __HALTESTELLE_H
#define __HALTESTELLE_H

#include <parson.h>

char* hs_designation();
void  serial_write(char* msg, ...);
void  network_write(char* msg, ...);

void hs_startup();
void hs_shutdown();
void do_serial(char* msg);
void do_network(JSON_Value* json, char* msg);

#endif
