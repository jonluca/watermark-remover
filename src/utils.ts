export function replaceBuffer(data: Buffer, pattern: Buffer) {
  let position = data.indexOf(pattern);

  while (position !== -1) {
    data.fill(0, position, position + pattern.length);
    // continue search:
    position = data.indexOf(pattern, position + pattern.length + 1);
  }
}

const byteToHex: string[] = [];

for (let n = 0; n <= 0xff; ++n) {
  const hexOctet = n.toString(16).padStart(4, "0");
  byteToHex.push(hexOctet);
}

export function bufferToHex(arrayBuffer: Buffer) {
  const buff = new Uint8Array(arrayBuffer);
  const hexOctets = []; // new Array(buff.length) is even faster (preallocates necessary array size), then use hexOctets[i] instead of .push()

  for (let i = 0; i < buff.length; ++i) {
    hexOctets.push(byteToHex[buff[i]]);
  }

  return hexOctets.join("");
}
