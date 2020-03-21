const id = 256

const arr = [id & 255, (id >> 8) & 255, id >> 16]

const reformat = arr[0] + (arr[1] << 8) + (arr[2] << 16)

const reformat2 = arr[0] + (arr[1] * 256) + (arr[2] * 256 * 256)

console.log(id, arr, reformat, reformat2)
