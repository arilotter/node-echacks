#include <pjsua-lib/pjsua.h>

#define THIS_FILE "APP"

#define SIP_DOMAIN "echacks-dialup.sip.twilio.com"
#define SIP_USER "sip"
#define SIP_PASSWD "WildWildWest123"


/*
null sample rate: 16000
mono audio
16 bits per sample

signed 16 bit pcm
little endian
mono
16000 kHz
*/

/* Display error and exit application */
static void error_exit(const char *title, pj_status_t status)
{
    pjsua_perror(THIS_FILE, title, status);
    pjsua_destroy();
    exit(1);
}

// helper for creating call-recorder
static void create_recorder(pjsua_call_info ci)
{
    // specify target file
    pj_str_t rec_file = pj_str("output.raw");
    pj_status_t status = PJ_ENOTFOUND;

    pjsua_recorder_id rec_id = PJSUA_INVALID_ID;
    // Create recorder for call
    status = pjsua_recorder_create(&rec_file, 0, NULL, 0, 0, &rec_id);
    if (status != PJ_SUCCESS)
        error_exit("Error recording call", status);

    // connect active call to call recorder
    pjsua_conf_port_id rec_port = pjsua_recorder_get_conf_port(rec_id);
    pjsua_conf_connect(ci.conf_slot, rec_port);
}

/* Callback called by the library when call's state has changed */
static void on_call_state(pjsua_call_id call_id, pjsip_event *e)
{
    pjsua_call_info ci;

    PJ_UNUSED_ARG(e);

    pjsua_call_get_info(call_id, &ci);
    PJ_LOG(3, (THIS_FILE, "Call %d state=%.*s", call_id,
               (int)ci.state_text.slen,
               ci.state_text.ptr));
}

/* Callback called by the library when call's media state has changed */
static void on_call_media_state(pjsua_call_id call_id)
{
    pjsua_call_info ci;

    pjsua_call_get_info(call_id, &ci);

    if (ci.media_status == PJSUA_CALL_MEDIA_ACTIVE)
    {
        // create_recorder(ci);
        // connect call to loopback device "speakers"
        pjsua_conf_connect(ci.conf_slot, 0);
        // connect loopback device "monitor" to call
        pjsua_conf_connect(0, ci.conf_slot);
    }
}

int main(int argc, char *argv[])
{
    pjsua_acc_id acc_id;
    pj_status_t status;

    /* Create pjsua first! */
    status = pjsua_create();
    if (status != PJ_SUCCESS)
        error_exit("Error in pjsua_create()", status);

    /* Init pjsua */
    {
        pjsua_config cfg;
        pjsua_logging_config log_cfg;

        pjsua_logging_config_default(&log_cfg);
        log_cfg.console_level = 0; // only log fatal errors

        pjsua_config_default(&cfg);
        cfg.cb.on_call_media_state = &on_call_media_state;
        cfg.cb.on_call_state = &on_call_state;

        status = pjsua_init(&cfg, &log_cfg, NULL);
        if (status != PJ_SUCCESS)
            error_exit("Error in pjsua_init()", status);
        // pjsua_set_null_snd_dev(); // Disable Linux audio support.
    }

    /* Add UDP transport. */
    {
        pjsua_transport_config cfg;

        pjsua_transport_config_default(&cfg);
        cfg.port = 5060;
        status = pjsua_transport_create(PJSIP_TRANSPORT_UDP, &cfg, NULL);
        if (status != PJ_SUCCESS)
            error_exit("Error creating transport", status);
    }

    /* Initialization is done, now start pjsua */
    status = pjsua_start();
    if (status != PJ_SUCCESS)
        error_exit("Error starting pjsua", status);

    /* Register to SIP server by creating SIP account. */
    {
        pjsua_acc_config cfg;

        pjsua_acc_config_default(&cfg);
        cfg.id = pj_str("sip:" SIP_USER "@" SIP_DOMAIN);
        cfg.reg_uri = pj_str("sip:" SIP_DOMAIN);
        cfg.cred_count = 1;
        cfg.cred_info[0].realm = pj_str("*");
        cfg.cred_info[0].scheme = pj_str("digest");
        cfg.cred_info[0].username = pj_str(SIP_USER);
        cfg.cred_info[0].data_type = PJSIP_CRED_DATA_PLAIN_PASSWD;
        cfg.cred_info[0].data = pj_str(SIP_PASSWD);

        status = pjsua_acc_add(&cfg, PJ_TRUE, &acc_id);
        if (status != PJ_SUCCESS)
            error_exit("Error adding account", status);
    }

    /* Make call to the URL. */
    {
        pj_str_t uri = pj_str("sip:echacks-dialup.sip.twilio.com");
        status = pjsua_call_make_call(acc_id, &uri, 0, NULL, NULL, NULL);
        if (status != PJ_SUCCESS)
            error_exit("Error making call", status);
    }

    /* Wait until user press "q" to quit. */
    for (;;)
    {
        char option[10];

        if (fgets(option, sizeof(option), stdin) == NULL)
        {
            puts("EOF while reading stdin, will quit now..");
            break;
        }

        if (option[0] == 'q')
            break;

        if (option[0] == 'h')
        {
            pjsua_call_hangup_all();
        }
    }

    /* Destroy pjsua */
    pjsua_destroy();

    return 0;
}
