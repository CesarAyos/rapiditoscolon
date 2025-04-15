// src/global.d.ts
export {}; // Esto es necesario para convertir el archivo en un módulo

declare global {
  interface Window {
    pickupPassenger: (passengerId: string) => void; // Ajusta el tipo según tu función
  }
}