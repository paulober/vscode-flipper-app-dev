#include <furi.h>

#define TAG "<app_name>"

// Application entry point
int32_t <app_id>_main(void* p) {
    // Mark argument as unused
    UNUSED(p);

    FURI_LOG_E(TAG, "Hello, World!");

    return 0;
}
