export function getLocalModelParams() {
  // You can tweak these numbers to optimize performance
  return {
    chunkSize: 400, // reduce from 500
    temperature: 0.6, // slightly lower for faster infer
  };
}
