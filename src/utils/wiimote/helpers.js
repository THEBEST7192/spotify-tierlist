export function toBigEndian(n, size){
  var value = Number(n);
  var buffer = new Array(size);
  for (let i = size - 1; i >= 0; i--) {
    buffer[i] = value % 256;
    value = Math.floor(value / 256);
  }
  return buffer;
}

export function numbersToBuffer(data) {
  return new Uint8Array(data);
}

export function getBitInByte(byte, index) {
  return byte & (1 << (index - 1));
}