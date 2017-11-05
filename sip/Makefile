#Modify this to point to the PJSIP location.
PJBASE=../pjproject-2.7

include $(PJBASE)/build.mak

CC      = $(PJ_CC)
LDFLAGS = $(PJ_LDFLAGS)
LDLIBS  = $(PJ_LDLIBS)
CFLAGS  = $(PJ_CFLAGS)
CPPFLAGS= ${CFLAGS}

all: sip

sip: sip.c
	$(CC) -o $@ $<  $(CPPFLAGS) $(LDFLAGS) $(LDLIBS)

clean:
	rm -rf sip.o sip