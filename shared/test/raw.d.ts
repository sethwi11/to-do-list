// Lets the tests import the sample documents as text: import text from './samples/x.txt?raw'.
declare module '*.txt?raw' {
  const text: string;
  export default text;
}
