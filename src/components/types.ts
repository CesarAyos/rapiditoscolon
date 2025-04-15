export type CarreraPayload = {
    new: Ride;  // Usamos tu tipo Ride existente
    old?: Partial<Ride>;
    event: 'INSERT' | 'UPDATE' | 'DELETE';
  };
  
  export type Ride = {
    id: string;
    usuario_id: string;
    conductor_id?: string;
    punto_recogida: { coordinates: [number, number] };
    punto_destino?: { coordinates: [number, number] };
    direccion_recogida: string;
    direccion_destino?: string;
    hora_servicio: string;
    lleva_maletas: boolean;
    cantidad_maletas?: number;
    estado: 'pendiente' | 'aceptada' | 'en_progreso' | 'completada' | 'cancelada';
    pasajero?: {
      primernombre: string;
      primerapellido: string;
      email: string;
    };
    creado_en: string;
  };
  
  export type OptimizedRoute = {
    carrera_id: string;
    orden_secuencia: number;
    distancia_metros: number;
  };