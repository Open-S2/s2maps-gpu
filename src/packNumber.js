

let x = 1 << 30

let arr = [0, 0, 0, 0]

arr[0] = x & 255
arr[1] = (x & (255 * 256)) >> 8
arr[2] = (x & (255 * 256 * 256)) >> 16
arr[3] = (x & (255 * 256 * 256 * 256)) >> 24

console.log(arr)

// console.log(get_bits(255 * 256 * 256))
//
// function get_bits (value) {
//     const base2_ = (value).toString(2).split("").reverse().join("");
//     const baseL_ = new Array(32 - base2_.length).join("0");
//     const base2 = base2_ + baseL_;
//     return base2;
// }
