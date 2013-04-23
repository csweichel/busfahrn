#include <stdio.h>
#include <stdlib.h>
#include <stdarg.h>
#include <unistd.h>
#include <errno.h>
#include <string.h>
#include <ifaddrs.h>
#include <sys/types.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <netdb.h>

#include <errno.h>
#include <termios.h>
#include <unistd.h>
#include <fcntl.h>
#include <asm/ioctls.h>

#include <pthread.h>

#include "haltestelle.h"
//define USE_SERIAL
//define SERIAL_BAUDRATE B115200
//define SERIAL_BAUDRATE B9600
//define SERIAL_IS_A_FILE
//define SERIAL_IS_A_ATH0


#define MYPORT "4950"    // the port users will be connecting to
#define MAXBUFLEN 1024
#define MIN(a,b) ((a) < (b) ? (a) : (b))

int sockfd;
char* busfarhn_host;
int busfarhn_port;
#ifdef SERIAL_IS_A_FILE
FILE* serialfd;
#else
int serialfd;
#endif
char* designation;

char* hs_designation() {
    return designation;
}

// get sockaddr, IPv4 or IPv6:
void *get_in_addr(struct sockaddr *sa) {
    if (sa->sa_family == AF_INET) {
        return &(((struct sockaddr_in*)sa)->sin_addr);
    }

    return &(((struct sockaddr_in6*)sa)->sin6_addr);
}

int connect_to_busfarhn(char* designation) {
    struct sockaddr_in servaddr;
    bzero(&servaddr, sizeof(servaddr));
    servaddr.sin_family = AF_INET;
    servaddr.sin_addr.s_addr = inet_addr(busfarhn_host);
    servaddr.sin_port = htons(busfarhn_port);

    if(connect(sockfd, (struct sockaddr *) &servaddr, sizeof(servaddr)) < 0) 
        return -1;

    char msg[250];
    snprintf(msg, sizeof(msg), "{ \"type\":\"io.tcp.name\", \"msg\" : { \"name\":\"%s\" } }\n", designation);
    write(sockfd, msg, strlen(msg));

    return 0;
}

void network_write(char* msg, ...) {
    va_list args;
    va_start( args, msg );

    char buffer[1024];
    vsnprintf(buffer, sizeof(buffer), msg, args);
    write(sockfd, buffer, strlen(buffer));

    printf("NET >> %s\n", buffer);

    va_end( args );
}

void serial_write(char* msg, ...) {
    va_list args;
    va_start( args, msg );

    char buffer[1024];
    vsnprintf(buffer, sizeof(buffer), msg, args);
    printf("SERIAL >> %s\n", buffer);
    #ifdef USE_SERIAL
    #ifdef SERIAL_IS_A_FILE
    fwrite(buffer, 1, strlen(buffer), serialfd);
    fflush(serialfd);
    #else
    write(serialfd, buffer, strlen(buffer));
    #endif
    #endif

    va_end( args );
}

int start_socket() {
    return socket(AF_INET, SOCK_STREAM, 0);
}

int set_interface_attribs (int fd, int speed, int parity) {
    struct termios tty;
    memset (&tty, 0, sizeof tty);
    if (tcgetattr (fd, &tty) != 0) {
        fprintf(stderr, "error %d from tcgetattr", errno);
        return -1;
    }

    cfsetospeed (&tty, speed);
    cfsetispeed (&tty, speed);

    tty.c_cflag = (tty.c_cflag & ~CSIZE) | CS8;     // 8-bit chars
    // disable IGNBRK for mismatched speed tests; otherwise receive break
    // as \000 chars
    tty.c_iflag &= ~IGNBRK;         // ignore break signal
    tty.c_lflag = 0;                // no signaling chars, no echo,
                                    // no canonical processing
    tty.c_oflag = 0;                // no remapping, no delays
    tty.c_cc[VMIN]  = 0;            // read doesn't block
    tty.c_cc[VTIME] = 5;            // 0.5 seconds read timeout

    tty.c_iflag &= ~(IXON | IXOFF | IXANY); // shut off xon/xoff ctrl

    tty.c_cflag |= (CLOCAL | CREAD);// ignore modem controls,
                                    // enable reading
    tty.c_cflag &= ~(PARENB | PARODD);      // shut off parity
    tty.c_cflag |= parity;
    tty.c_cflag &= ~CSTOPB;
    tty.c_cflag &= ~CRTSCTS;

    if (tcsetattr (fd, TCSANOW, &tty) != 0) {
        fprintf(stderr, "error %d from tcsetattr", errno);
        return -1;
    }
    return 0;
}

void set_blocking (int fd, int should_block) {
    struct termios tty;
    memset (&tty, 0, sizeof tty);
    if (tcgetattr (fd, &tty) != 0) {
        fprintf(stderr, "error %d from tggetattr", errno);
        return;
    }

    tty.c_cc[VMIN]  = should_block ? 1 : 0;
    tty.c_cc[VTIME] = 5;            // 0.5 seconds read timeout

    if (tcsetattr (fd, TCSANOW, &tty) != 0)
        fprintf(stderr, "error %d setting term attributes", errno);
}

/*
 * taken from: http://stackoverflow.com/questions/122616/how-do-i-trim-leading-trailing-whitespace-in-a-standard-way
 */
char *trimwhitespace(char *str) {
  char *end;

  // Trim leading space
  while(isspace(*str)) str++;

  if(*str == 0)  // All spaces?
    return str;

  // Trim trailing space
  end = str + strlen(str) - 1;
  while(end > str && isspace(*end)) end--;

  // Write new null terminator
  *(end+1) = 0;

  return str;
}

char serialbuf[MAXBUFLEN];
unsigned int serialbufpos = 0;
void *thread_read_serial(void *arg) {
    while(1) {
        // serial
        int n;
        #ifdef SERIAL_IS_A_FILE
        n = fread((serialbuf + serialbufpos), 1, MAXBUFLEN - (serialbufpos + 1), serialfd);
        #else
        n = read (serialfd, (serialbuf + serialbufpos), MAXBUFLEN - (serialbufpos + 1));
        printf("[SERIAL READING] %d bytes\n", n);
        #endif
        if(n > 0) {
            printf("[SERIAL] %s\n", serialbuf);

            int i = 0;
            for(i = 0; i < n; i++) if(serialbuf[serialbufpos + i] == '\n') break;
            serialbufpos += n;

            if(i < n) {
                // found breakline
                serialbuf[serialbufpos - 1] = '\0';
                trimwhitespace(serialbuf);
                serialbufpos = 0;
                
                do_serial(serialbuf);
            }
        }
    }
}

#ifndef CUSTOM_PING
void do_ping() {
    network_write("{ \"type\":\"io.tcp.pong\", \"msg\":{\"name\":\"%s\"} }", hs_designation());
}
#endif

int main(int argc, char** argv) {
    printf("haltestelle built <%s %s> version %s\n", __DATE__, __TIME__, VERSION);
    if(argc < 5) {
        fprintf(stderr, "usage: %s <designation> <busfarhn_host> <busfarhn_port> <serialport>\n", argv[0]);
        exit(-1);
    }

    /*global*/ designation   = argv[1];
    /*global*/ busfarhn_host = argv[2];
    /*global*/ busfarhn_port = atoi(argv[3]);
    char*      serialport    = argv[4];

    /*global*/ sockfd = start_socket();
    if(connect_to_busfarhn(designation) != 0) {
        fprintf(stderr, "[ERROR] connecting to %s:%d failed\n", busfarhn_host, busfarhn_port);
        return -1;
    }
#ifdef USE_SERIAL
    #ifdef SERIAL_IS_A_FILE
    printf("%s is a FILE\n", serialport);
    #elif defined SERIAL_IS_A_ATH0
    printf("%s is a SERIAL PORT (ATH style)\n", serialport);
    #else
    printf("%s is a SERIAL PORT\n", serialport);
    #endif
#else
    printf("WARNING: NOT USING THE SERIAL PORT\n");
#endif
    printf("[STARTUP] connected to %s:%i with designation %s\n", busfarhn_host, busfarhn_port, designation);

#ifdef USE_SERIAL
    #ifdef SERIAL_IS_A_FILE
    /*global*/ serialfd = fopen(serialport, "rw");
    #elif defined SERIAL_IS_A_ATH0
    /*global*/ serialfd = open(serialport, O_RDWR);
    #else
    /*global*/ serialfd = open(serialport, O_RDWR | O_NOCTTY | O_SYNC);
    #endif
    
    if (serialfd < 0) {
        fprintf(stderr, "error %d opening %s: %s", errno, serialport, strerror (errno));
        return;
    }

    #if !(defined SERIAL_IS_A_FILE || defined SERIAL_IS_A_ATH0)
    set_interface_attribs (serialfd, SERIAL_BAUDRATE, 0);  // set speed to 115,200 bps, 8n1 (no parity)
    set_blocking (serialfd, 0);                // set no blocking
    #endif
#endif

    hs_startup();

    char netbuf[MAXBUFLEN];
    unsigned int netbufpos = 0;

    struct sockaddr_storage their_addr;
    socklen_t addr_len;

#ifdef USE_SERIAL
    pthread_t pth;
    pthread_create(&pth, NULL, thread_read_serial, NULL);
#endif

    while(1) {
        // network
        int numbytes;
        addr_len = sizeof their_addr;
        if ((numbytes = recvfrom(sockfd, (netbuf + netbufpos), MAXBUFLEN - (netbufpos + 1), MSG_DONTWAIT, (struct sockaddr *)&their_addr, &addr_len)) > 0) {
            printf("[NET] received %i bytes\n", numbytes);

            int i = 0;
            for(i = 0; i < numbytes; i++) if(netbuf[netbufpos + i] == '\n') break;
            netbufpos += numbytes;

            if(i < numbytes) {
                // found breakline
                netbuf[netbufpos - 1] = '\0';
                netbufpos = 0;
                
                printf("CMD <%s>\n", netbuf);
                JSON_Value* json = json_parse_string(netbuf);

                if(json_value_get_type(json) == JSONObject) {
                    JSON_Object* obj = json_value_get_object(json);
                    const char* msgtype = json_object_dotget_string(obj, "type");
                    
                    if(strcmp(msgtype, "io.tcp.ping") == 0) do_ping();
                    else                                    do_network(json, netbuf);
                }

                json_value_free(json);
            }

            if(netbufpos + 1 == MAXBUFLEN) {
                printf("[NET] ERROR: received %i bytes and still no breakline. Discarding the message.\n", MAXBUFLEN);
                netbufpos = 0;
            }
        } else if(numbytes == 0) {
            break;
        }
        
    }

    hs_shutdown();

    close(sockfd);

    return 0;
}
