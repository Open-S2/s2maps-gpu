# WASM

## Tools
https://webassembly.github.io/wabt/demo/wasm2wat/
https://mbebenita.github.io/WasmExplorer/
https://webassembly.studio/

## Tutorials

https://wasmbyexample.dev/examples/strings/strings.c.en-us.html

### SHA256
http://www.zedwood.com/article/cpp-sha256-function

### BUILD
https://v8.dev/blog/emscripten-standalone-wasm
https://gist.github.com/kripken/59c67556dc03bb6d57052fedef1e61ab
https://github.com/emscripten-core/emscripten/wiki/WebAssembly-Standalone
https://emscripten.org/docs/getting_started/FAQ.html
https://stackoverflow.com/questions/21816960/how-to-pass-strings-between-c-and-javascript-via-emscripten
https://emscripten.org/docs/porting/connecting_cpp_and_javascript/embind.html#embind
https://emscripten.org/docs/building_from_source/index.html

https://stackoverflow.com/questions/47529643/how-to-return-a-string-or-similar-from-rust-in-webassembly


### FLAGS
-O1   =>   slightly optimized
-O2   =>   fully optimized
-O3   =>   production

## CODE

```
emcc -Os -s STANDALONE_WASM -s EXPORTED_FUNCTIONS="['_hash']" "hash.cpp" -o "hash.wasm"
```

```
emcc -O1 -std=c++17 hash.cpp -s WASM=1 -s STANDALONE_WASM --bind -o hash.wasm
```

```
emcc -Os -s STANDALONE_WASM -s EXPORTED_FUNCTIONS="['_hash']" -l/usr/local/Cellar/openssl@1.1/1.1.1k/lib/libssl.a -l/usr/local/Cellar/openssl@1.1/1.1.1k/lib/libcrypto.a sha256.c -o hash.wasm
```
