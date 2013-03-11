#!/bin/bash

export STAGING_DIR=$HOME/tmp/trunk/staging_dir
export MIPS_GCC=$STAGING_DIR/toolchain-mips_r2_gcc-4.6-linaro_uClibc-0.9.33.2/bin/mips-openwrt-linux-uclibc-gcc

compile() {
	PREFIX=$1
	GCC=$2

	$GCC -c -I. -Iparson -o parson.o parson/parson.c
	for i in $(ls config/*.h); do
		bn=$(basename $i)
		impl=$(cat $i | grep IMPLEMENTATION | cut -d ' ' -f 3)

		echo "[CC] $bn $impl"

		cat $i tcp_serial.c > .tcp_serial_build.c
		$GCC -c -I. -Iparson -o tcp_serial.o .tcp_serial_build.c
		rm .tcp_serial_build.c
		$GCC -c -I. -Iparson -o config/${impl%%.c}.o config/$impl
		$GCC -o bin/tcphaltestelle.${bn%%.h}.$PREFIX config/${impl%%.c}.o parson.o tcp_serial.o -lm
	done

}

[ ! -d bin ] && mkdir bin
rm bin/*
compile x86 gcc
compile mips32 $MIPS_GCC
find . -name "*.o" | xargs rm
