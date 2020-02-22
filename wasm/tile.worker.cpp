#include <emscripten/fetch.h>
#include <emscripten/bind.h>

using namespace emscripten;

struct Layer {
  std::string id;
  std::string source;
  std::string layer;
  int minzoom;
  int maxzoom;
  enum type { fill, line, line3D, billboard, text };
  std::string filter;
  std::string layout;
  std::string paint;
}

struct SourceType {
  std::string path;
  enum type { vector, raster, font, billboard };
  std::string fileType;
  std::string sourceName;
};

struct StylePackage {
  SourceType sources,
  SourceType fonts,
  SourceType billboards,
  layers: std::vector<Layer>
}

class TileWorker {
  enum Status { Building, Busy, Ready };
public:
  TileWorker () {}

  void onMessage () {}

private:
  Status status = Ready;
  std::unordered_map<string, StylePackage>
}

// Binding code
EMSCRIPTEN_BINDINGS(my_class_example) {
  class_<TileWorker>("TileWorker")
    .constructor<int, std::string>()
    .function("incrementX", &TileWorker::incrementX)
    .property("x", &TileWorker::getX, &TileWorker::setX)
    ;
}
