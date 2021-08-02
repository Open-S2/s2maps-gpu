// hash.cpp
typedef long int i32;
extern "C" {
  void hash(i32 *plaintext, i32 plaintextLength) {
    i32 hash;
    i32 i;
    for (hash = i = 0; i < plaintextLength; ++i) {
      hash += plaintext[i];
      hash += (hash << 10);
      hash ^= (hash >> 6);
    }
    hash += (hash << 3);
    hash ^= (hash >> 11);
    hash += (hash << 15);

    plaintext[0] = hash;
  }
}
