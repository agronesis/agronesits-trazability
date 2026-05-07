// ─────────────────────────────────────────────
// TIPOS DE BASE DE DATOS SUPABASE
// Este archivo refleja la estructura de la DB
// y es la fuente de verdad para los tipos row
// ─────────────────────────────────────────────

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      agricultores: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          created_by: string
          codigo: string
          nombre: string
          apellido: string
          dni: string | null
          telefono: string | null
          numero_cuenta: string | null
          fecha_alta: string
          ubicacion: string | null
          estado: 'activo' | 'inactivo'
        }
        Insert: Omit<Database['public']['Tables']['agricultores']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['agricultores']['Insert']>
        Relationships: []
      }
      acopiadores: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          created_by: string
          codigo: string
          nombre: string
          apellido: string
          dni: string | null
          telefono: string | null
          numero_cuenta: string | null
          fecha_alta: string
          ubicacion: string | null
          estado: 'activo' | 'inactivo'
        }
        Insert: Omit<Database['public']['Tables']['acopiadores']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['acopiadores']['Insert']>
        Relationships: []
      }
      colaboradores: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          created_by: string
          codigo: string
          nombre: string
          apellido: string
          dni: string | null
          telefono: string | null
          numero_cuenta: string | null
          fecha_alta: string
          ubicacion: string | null
          rol: 'recepcionista' | 'seleccionador' | 'empaquetador'
          estado: 'activo' | 'inactivo'
        }
        Insert: Omit<Database['public']['Tables']['colaboradores']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['colaboradores']['Insert']>
        Relationships: []
      }
      productos: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          created_by: string
          codigo: string
          nombre: string
          variedad: 'snow_peas' | 'sugar'
          calidad: 'cat1' | 'cat2'
          tipo_produccion: 'organico' | 'convencional'
        }
        Insert: Omit<Database['public']['Tables']['productos']['Row'], 'id' | 'created_at' | 'updated_at' | 'codigo'> & {
          codigo?: string
        }
        Update: Partial<Database['public']['Tables']['productos']['Insert']>
        Relationships: []
      }
      personal_campo: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          created_by: string
          codigo: string
          nombre: string
          apellido: string
          dni: string | null
          telefono: string | null
          numero_cuenta: string | null
          fecha_alta: string
          tipo: 'clasificador' | 'cosechador' | 'empacador' | 'supervisor'
          tarifa_destajo: number
          estado: 'activo' | 'inactivo'
        }
        Insert: Omit<Database['public']['Tables']['personal_campo']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['personal_campo']['Insert']>
        Relationships: []
      }
      centros_acopio: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          created_by: string
          codigo: string
          nombre: string
          ubicacion: string | null
          responsable: string | null
          estado: 'activo' | 'inactivo'
        }
        Insert: Omit<Database['public']['Tables']['centros_acopio']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['centros_acopio']['Insert']>
        Relationships: []
      }
      lotes: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          created_by: string
          codigo: string
          agricultor_id: string
          recepcionista_id: string | null
          acopiador_id: string | null
          acopiador_agricultor_id: string | null
          producto_id: string
          centro_acopio_id: string
          fecha_ingreso: string
          fecha_cosecha: string
          peso_bruto_kg: number
          peso_tara_kg: number
          peso_neto_kg: number
          num_cubetas: number
          jabas_prestadas: number
          codigo_lote_agricultor: string | null
          observaciones: string | null
          estado: 'ingresado' | 'en_clasificacion' | 'clasificado' | 'empaquetado' | 'en_despacho' | 'despachado' | 'liquidado'
        }
        Insert: Omit<Database['public']['Tables']['lotes']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['lotes']['Insert']>
        Relationships: []
      }
      clasificaciones: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          created_by: string
          lote_id: string
          fecha_clasificacion: string
          peso_bueno_kg: number
          observaciones: string | null
        }
        Insert: {
          created_by: string
          lote_id: string
          fecha_clasificacion: string
          peso_bueno_kg?: number
          observaciones?: string | null
        }
        Update: Partial<Database['public']['Tables']['clasificaciones']['Insert']>
        Relationships: []
      }
      clasificacion_aportes: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          created_by: string
          clasificacion_id: string
          colaborador_id: string
          peso_bueno_kg: number
          kg_cat1: number
          kg_cat2: number
          kg_bruto: number
          num_jabas: number
          peso_tara_kg: number
          jabas_descartadas: number
          kg_bruto_descartable: number
          peso_tara_descartable_kg: number
          kg_neto_descartable: number
        }
        Insert: {
          created_by: string
          clasificacion_id: string
          colaborador_id: string
          peso_bueno_kg: number
          kg_cat1?: number
          kg_cat2?: number
          kg_bruto?: number
          num_jabas?: number
          peso_tara_kg?: number
          jabas_descartadas?: number
          kg_bruto_descartable?: number
          peso_tara_descartable_kg?: number
          kg_neto_descartable?: number
        }
        Update: Partial<Database['public']['Tables']['clasificacion_aportes']['Insert']>
        Relationships: []
      }
      clasificacion_mesas: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          created_by: string
          clasificacion_id: string
          nombre: string
          num_jabas: number
        }
        Insert: {
          created_by: string
          clasificacion_id: string
          nombre: string
          num_jabas?: number
        }
        Update: Partial<Database['public']['Tables']['clasificacion_mesas']['Insert']>
        Relationships: []
      }
      empaquetados: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          created_by: string
          lote_id: string
          fecha_empaquetado: string
          destino: 'europa' | 'usa'
          codigo_trazabilidad: string
          numero_pallet: string
          num_cajas: number
          observaciones: string | null
        }
        Insert: Omit<Database['public']['Tables']['empaquetados']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['empaquetados']['Insert']>
        Relationships: []
      }
      despachos: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          created_by: string
          codigo: string
          lote_id: string | null
          fecha_despacho: string
          destino: 'exportacion' | 'mercado_local' | 'planta_proceso'
          tipo_despacho: 'maritima' | 'aerea' | 'terrestre'
          exportador: string | null
          marca_caja: string | null
          transportista: string | null
          placa_vehiculo: string | null
          num_cajas_despachadas: number
          peso_neto_kg: number
          observaciones: string | null
        }
        Insert: Omit<Database['public']['Tables']['despachos']['Row'], 'id' | 'created_at' | 'updated_at' | 'codigo'> & { codigo?: string }
        Update: Partial<Database['public']['Tables']['despachos']['Insert']>
        Relationships: []
      }
      despacho_pallets: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          created_by: string
          despacho_id: string
          lote_id: string
          numero_pallet: string
          num_cajas: number
        }
        Insert: Omit<Database['public']['Tables']['despacho_pallets']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['despacho_pallets']['Insert']>
        Relationships: []
      }
      liquidaciones_agri: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          created_by: string
          codigo: string
          agricultor_id: string
          fecha_inicio: string
          fecha_fin: string
          total_kg: number
          total_monto: number
          estado: 'borrador' | 'confirmada' | 'pagada'
          observaciones: string | null
          fecha_pago: string | null
          numero_operacion: string | null
          modalidad_pago: 'transferencia' | 'yape_plin' | 'efectivo' | null
        }
        Insert: Omit<Database['public']['Tables']['liquidaciones_agri']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['liquidaciones_agri']['Insert']>
        Relationships: []
      }
      liquidacion_agri_detalle: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          created_by: string
          liquidacion_id: string
          lote_id: string
          categoria: 'primera' | 'segunda' | 'descarte'
          peso_kg: number
          precio_kg: number
          subtotal: number
        }
        Insert: Omit<Database['public']['Tables']['liquidacion_agri_detalle']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['liquidacion_agri_detalle']['Insert']>
        Relationships: []
      }
      actividades_personal: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          created_by: string
          personal_id: string
          lote_id: string
          tipo_actividad: 'clasificacion' | 'cosecha' | 'empaque' | 'carga'
          fecha: string
          cantidad_unidades: number
          tarifa_unitaria: number
          total: number
          observaciones: string | null
        }
        Insert: Omit<Database['public']['Tables']['actividades_personal']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['actividades_personal']['Insert']>
        Relationships: []
      }
      liquidaciones_personal: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          created_by: string
          codigo: string
          personal_id: string
          quincena: string
          total_unidades: number
          total_monto: number
          estado: 'borrador' | 'confirmada' | 'pagada'
          observaciones: string | null
        }
        Insert: Omit<Database['public']['Tables']['liquidaciones_personal']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['liquidaciones_personal']['Insert']>
        Relationships: []
      }
      movimientos_cubetas: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          created_by: string
          agricultor_id: string
          lote_id: string | null
          tipo: 'entrega' | 'devolucion'
          cantidad: number
          fecha: string
          observaciones: string | null
        }
        Insert: Omit<Database['public']['Tables']['movimientos_cubetas']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['movimientos_cubetas']['Insert']>
        Relationships: []
      }
      config_precios: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          created_by: string
          semana: number
          anio: number
          variedad: 'snow_peas' | 'sugar'
          categoria: 'cat1' | 'cat2'
          precio_kg_sol: number
        }
        Insert: Omit<Database['public']['Tables']['config_precios']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['config_precios']['Insert']>
        Relationships: []
      }
      config_sistema: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          created_by: string
          clave: string
          nombre: string
          descripcion: string | null
          valor_texto: string | null
          valor_numerico: number | null
        }
        Insert: Omit<Database['public']['Tables']['config_sistema']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['config_sistema']['Insert']>
        Relationships: []
      }
      planillas_quincenales: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          created_by: string
          periodo_inicio: string
          periodo_fin: string
          total_monto: number
          estado: 'borrador' | 'confirmada' | 'pagada'
          observaciones: string | null
          fecha_pago: string | null
          numero_operacion: string | null
          modalidad_pago: 'transferencia' | 'yape_plin' | 'efectivo' | null
        }
        Insert: Omit<Database['public']['Tables']['planillas_quincenales']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['planillas_quincenales']['Insert']>
        Relationships: []
      }
      planilla_detalles: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          created_by: string
          planilla_id: string
          colaborador_id: string
          kg_bruto_recepcion: number
          pago_recepcion: number
          kg_cat1_seleccion: number
          kg_cat2_seleccion: number
          pago_seleccion: number
          n_cajas_empaquetado: number
          monto_empaquetado: number
          otros_montos: number
          total: number
        }
        Insert: Omit<Database['public']['Tables']['planilla_detalles']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['planilla_detalles']['Insert']>
        Relationships: []
      }
      audit_logs: {
        Row: {
          id: string
          created_at: string
          user_id: string
          user_email: string
          accion: 'crear' | 'actualizar' | 'eliminar'
          modulo: string
          registro_id: string
          descripcion: string
          datos_anteriores: Record<string, unknown> | null
          datos_nuevos: Record<string, unknown> | null
        }
        Insert: Omit<Database['public']['Tables']['audit_logs']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['audit_logs']['Insert']>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      estado_activo: 'activo' | 'inactivo'
      estado_lote: 'ingresado' | 'en_clasificacion' | 'clasificado' | 'empaquetado' | 'en_despacho' | 'despachado' | 'liquidado'
      estado_liquidacion: 'borrador' | 'confirmada' | 'pagada'
      tipo_producto: 'holantao' | 'snow_peas' | 'otro'
      tipo_personal: 'clasificador' | 'cosechador' | 'empacador' | 'supervisor'
      categoria_clasificacion: 'primera' | 'segunda' | 'descarte'
      destino_despacho: 'exportacion' | 'mercado_local' | 'planta_proceso'
      tipo_movimiento_cubeta: 'entrega' | 'devolucion'
      tipo_actividad: 'clasificacion' | 'cosecha' | 'empaque' | 'carga'
    }
  }
}
