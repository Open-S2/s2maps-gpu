// float Pack(Vector2 input, int precision)
// {
//     Vector2 output = input;
//     output.x = Mathf.Floor(output.x * (precision - 1));
//     output.y = Mathf.Floor(output.y * (precision - 1));
//
//     return (output.x * precision) + output.y;
// }
//
// Vector2 Unpack(float input, int precision)
// {
//     Vector2 output = Vector2.zero;
//
//     output.y = input % precision;
//     output.x = Mathf.Floor(input / precision);
//
//     return output / (precision - 1);
// }

const PRECISION = 4096

function pack (input) {
  let x = Math.floor(input[0] * (PRECISION - 1))
  let y = Math.floor(input[1] * (PRECISION - 1))

  return Math.fround((x * PRECISION) + y)
}

function unpack (input) {
  const denom = PRECISION - 1

  return [
    Math.floor(input / PRECISION) / denom,
    (input % PRECISION) / denom
  ]
}


let test = [0, -1]

const packed = pack(test)
const unpacked = unpack(Math.fround(packed))

console.log('packed', packed)
console.log('unpacked', unpacked)
