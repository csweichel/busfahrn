#!/bin/bash

export STAGING_DIR=$HOME/tmp/trunk/staging_dir
export MIPS_GCC=$STAGING_DIR/toolchain-mips_r2_gcc-4.6-linaro_uClibc-0.9.33.2/bin/mips-openwrt-linux-uclibc-gcc

compile() {
	PREFIX=$1
	GCC=$2

	$GCC -c -I. -Iparson -o parson.o parson/parson.c
	$GCC -c -I. -Iparson -o udp_serial.o udp_serial.c
	for i in $(ls config/*.c); do
		bn=$(basename $i)
		$GCC -c -I. -Iparson -o ${i%%.c}.o $i
		$GCC -o bin/udphaltestelle.${bn%%.c}.$PREFIX ${i%%.c}.o parson.o udp_serial.o -lm
	done

	$GCC -c -I. -Iparson -o tcp_serial.o tcp_serial.c
	for i in $(ls config/*.c); do
		bn=$(basename $i)
		$GCC -c -I. -Iparson -o ${i%%.c}.o $i
		$GCC -o bin/tcphaltestelle.${bn%%.c}.$PREFIX ${i%%.c}.o parson.o tcp_serial.o -lm
	done 
}

[ ! -d bin ] && mkdir bin
rm bin/*
compile x86 gcc
compile mips32 $MIPS_GCC
find . -name "*.o" | xargs rm
