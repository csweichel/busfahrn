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

#include "haltestelle.h"

#define MYPORT "4950"    // the port users will be connecting to
#define MAXBUFLEN 100

int sockfd;
char* busfarhn_host;
int busfarhn_port;
int serialfd;
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

void send_to_busfarhn(char* msg) {
    struct sockaddr_in servaddr;
    bzero(&servaddr, sizeof(servaddr));
    servaddr.sin_family = AF_INET;
    servaddr.sin_addr.s_addr = inet_addr(busfarhn_host);
    servaddr.sin_port = htons(busfarhn_port);

    printf("sent msg to %s:%i :: %s\n", busfarhn_host, busfarhn_port, msg);
    sendto(sockfd, msg, strlen(msg),0, (struct sockaddr *)&servaddr,sizeof(servaddr));
}

void register_at_busfarhn(char* designation) {
    char msg[250];
    snprintf(msg, sizeof(msg), "{ \"type\":\"io.udp.register\", \"msg\" : { \"designation\":\"%s\", \"port\": %s } }", designation, MYPORT);
    send_to_busfarhn(msg);
}

void network_write(char* msg, ...) {
    va_list args;
    va_start( args, msg );

    char buffer[1024];
    vsnprintf(buffer, sizeof(buffer), msg, args);
    send_to_busfarhn(buffer);

    va_end( args );
}

void serial_write(char* msg, ...) {
    va_list args;
    va_start( args, msg );

    char buffer[1024];
    vsnprintf(buffer, sizeof(buffer), msg, args);
    write(serialfd, buffer, strlen(buffer));

    va_end( args );
}

int start_socket() {
    int sockfd;
    struct addrinfo hints, *servinfo, *p;
    int rv;
    char s[INET6_ADDRSTRLEN];

    memset(&hints, 0, sizeof hints);
    hints.ai_family = AF_INET; // set to AF_INET to force IPv4
    hints.ai_socktype = SOCK_DGRAM;
    hints.ai_flags = AI_PASSIVE; // use my IP

    if ((rv = getaddrinfo(NULL, MYPORT, &hints, &servinfo)) != 0) {
        fprintf(stderr, "getaddrinfo: %s\n", gai_strerror(rv));
        exit(1);
    }

    // loop through all the results and bind to the first we can
    for(p = servinfo; p != NULL; p = p->ai_next) {
        if ((sockfd = socket(p->ai_family, p->ai_socktype, p->ai_protocol)) == -1) {
            perror("listener: socket");
            continue;
        }

        if (bind(sockfd, p->ai_addr, p->ai_addrlen) == -1) {
            close(sockfd);
            perror("listener: bind");
            continue;
        }

        break;
    }

    if (p == NULL) {
        fprintf(stderr, "listener: failed to bind socket\n");
        exit(2);
    }
    freeaddrinfo(servinfo);

    return sockfd;
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


int main(int argc, char** argv) {
    if(argc < 5) {
        fprintf(stderr, "usage: %s <designation> <busfarhn_host> <busfarhn_port> <serialport>\n", argv[0]);
        exit(-1);
    }

    /*global*/ designation   = argv[1];
    /*global*/ busfarhn_host = argv[2];
    /*global*/ busfarhn_port = atoi(argv[3]);
    char*      serialport    = argv[4];

    /*global*/ sockfd = start_socket();
    printf("[STARTUP] udp server running on port %s\n", MYPORT);
    register_at_busfarhn(designation);
    printf("[STARTUP] registration sent to %s:%i with designation %s\n", busfarhn_host, busfarhn_port, designation);

    
    /*global*/ serialfd = open (serialport, O_RDWR | O_NOCTTY | O_SYNC);
    if (serialfd < 0) {
        fprintf(stderr, "error %d opening %s: %s", errno, serialport, strerror (errno));
        return;
    }
    set_interface_attribs (serialfd, B9600, 0);  // set speed to 115,200 bps, 8n1 (no parity)
    set_blocking (serialfd, 0);                // set no blocking

    char serialbuf[MAXBUFLEN];
    unsigned int serialbufpos = 0;

    char netbuf[MAXBUFLEN];
    int numbytes;
    struct sockaddr_storage their_addr;
    socklen_t addr_len;

    // add gracefull way to exit and disable PIR in the process

    while(1) {
        // serial
        int n = read (serialfd, (serialbuf + serialbufpos), MAXBUFLEN - (serialbufpos + 1));  // read up to 100 characters if ready to read
        if(n > 0) {
            printf("[SERIAL] %s\n", serialbuf);

            int i = 0;
            for(i = 0; i < n; i++) if(serialbuf[serialbufpos + i] == '\n') break;
            serialbufpos += n;

            if(i < n) {
                // found breakline
                serialbuf[serialbufpos - 1] = '\0';
                serialbufpos = 0;

                do_serial(serialbuf);
            }
        }

        // network
        addr_len = sizeof their_addr;
        if ((numbytes = recvfrom(sockfd, netbuf, MAXBUFLEN - 1, MSG_DONTWAIT, (struct sockaddr *)&their_addr, &addr_len)) > -1) {
            printf("[NET] received %i bytes\n", numbytes);
            netbuf[numbytes] = '\0';

            printf("CMD <%s>\n", netbuf);
            do_network(netbuf);
        }
        
    }

    close(sockfd);

    return 0;
}
