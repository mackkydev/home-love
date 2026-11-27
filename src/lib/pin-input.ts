export const PIN_LENGTH = 6;

export function appendPinDigit(pin: string, digit: string) {
  if (!/^\d$/.test(digit) || !/^\d{0,6}$/.test(pin)) return pin;
  return pin.length < PIN_LENGTH ? pin + digit : pin;
}

export function erasePinDigit(pin: string) {
  return pin.slice(0, -1);
}

export function isCompletePin(pin: string) {
  return /^\d{6}$/.test(pin);
}
