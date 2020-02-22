#include <string.h>
#include <emscripten/fetch.h>
#include <emscripten/bind.h>

using namespace emscripten;

// EM_JS(void, downloadSucceeded, (), {
//   console.log('success');
// });

void downloadSucceeded (emscripten_fetch_t *fetch) {
  // The data is now available at fetch->data[0] through fetch->data[fetch->numBytes-1];
  emscripten_fetch_close(fetch); // Free data associated with the fetch.
}

void downloadFailed (emscripten_fetch_t *fetch) {
  emscripten_fetch_close(fetch); // Also free data on failure.
}

int requestData (string path, string extension) {
  emscripten_fetch_attr_t attr;
  emscripten_fetch_attr_init(&attr);
  strcpy(attr.requestMethod, "GET");
  attr.attributes = EMSCRIPTEN_FETCH_LOAD_TO_MEMORY;
  attr.onsuccess = downloadSucceeded;
  attr.onerror = downloadFailed;
  emscripten_fetch(&attr, path);
}

EMSCRIPTEN_BINDINGS (my_module) {
  function("requestData", &requestData);
}
