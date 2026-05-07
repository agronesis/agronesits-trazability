import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ROUTES, ENABLED_MODULES } from '@/constants'
import { useAuthInit } from '@/hooks/useAuthInit'
import { useAuthStore } from '@/store/auth.store'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { AppLayout } from '@/components/layout/AppLayout'
import { APP_PERMISSIONS, getDefaultRouteForRoles } from '@/lib/permissions'

import LoginPage from '@/features/auth/LoginPage'
import DashboardPage from '@/features/dashboard/DashboardPage'
import AgricultoresPage from '@/features/agricultores/AgricultoresPage'
import AcopiadoresPage from '@/features/acopiadores/AcopiadoresPage'
import ColaboradoresPage from '@/features/colaboradores/ColaboradoresPage'
import ProductosPage from '@/features/productos/ProductosPage'
import CentrosAcopioPage from '@/features/centros-acopio/CentrosAcopioPage'
import LotesPage from '@/features/lotes/LotesPage'
import LoteDetallePage from '@/features/lotes/LoteDetallePage'
import ClasificarLotePage from '@/features/lotes/ClasificarLotePage'
import EmpaquetarLotePage from '@/features/lotes/EmpaquetarLotePage'
import DespachosPage from '@/features/despachos/DespachosPage'
import NuevoDespachoPage from '@/features/despachos/NuevoDespachoPage'
import DetalleDespachoPage from '@/features/despachos/DetalleDespachoPage'
import LiquidacionesAgriPage from '@/features/liquidaciones-agri/LiquidacionesAgriPage'
import NuevaLiquidacionAgriPage from '@/features/liquidaciones-agri/NuevaLiquidacionAgriPage'
import DetalleLiquidacionAgriPage from '@/features/liquidaciones-agri/DetalleLiquidacionAgriPage.tsx'
import CubetasPage from '@/features/cubetas/CubetasPage.tsx'
import ConfigPreciosPage from '@/features/admin/ConfigPreciosPage'
import ConfigParametrosPage from '@/features/admin/ConfigParametrosPage'
import PlanillasPage from '@/features/planillas/PlanillasPage'
import TareoDiarioPage from '@/features/tareo/TareoDiarioPage'
import AuditLogPage from '@/features/gerencia/AuditLogPage'

function LoginRoute() {
  const { user, loading, roles } = useAuthStore()

  if (loading) return null
  if (user) return <Navigate to={getDefaultRouteForRoles(roles)} replace />
  return <LoginPage />
}

export default function App() {
  useAuthInit()

  return (
    <BrowserRouter>
      <Routes>
        <Route path={ROUTES.LOGIN} element={<LoginRoute />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path={ROUTES.DASHBOARD} element={<ProtectedRoute permission={APP_PERMISSIONS.DASHBOARD_VIEW}><DashboardPage /></ProtectedRoute>} />
            <Route path={ROUTES.AGRICULTORES} element={<ProtectedRoute permission={APP_PERMISSIONS.AGRICULTORES_VIEW}><AgricultoresPage /></ProtectedRoute>} />
            <Route path={ROUTES.ACOPIADORES} element={<ProtectedRoute permission={APP_PERMISSIONS.MAESTROS_MANAGE}><AcopiadoresPage /></ProtectedRoute>} />
            <Route path={ROUTES.COLABORADORES} element={<ProtectedRoute permission={APP_PERMISSIONS.MAESTROS_MANAGE}><ColaboradoresPage /></ProtectedRoute>} />
            <Route path={ROUTES.PRODUCTOS} element={<ProtectedRoute permission={APP_PERMISSIONS.MAESTROS_MANAGE}><ProductosPage /></ProtectedRoute>} />
            <Route path={ROUTES.CENTROS_ACOPIO} element={<ProtectedRoute permission={APP_PERMISSIONS.MAESTROS_MANAGE}><CentrosAcopioPage /></ProtectedRoute>} />
            <Route path={ROUTES.LOTES} element={<ProtectedRoute permission={APP_PERMISSIONS.LOTES_VIEW}><LotesPage /></ProtectedRoute>} />
            <Route path={ROUTES.LOTES_DETALLE} element={<ProtectedRoute permission={APP_PERMISSIONS.LOTES_VIEW}><LoteDetallePage /></ProtectedRoute>} />
            <Route path={ROUTES.CLASIFICACIONES} element={<ProtectedRoute permission={APP_PERMISSIONS.LOTES_PROCESS}><ClasificarLotePage /></ProtectedRoute>} />
            <Route path={ROUTES.EMPAQUETAR} element={<ProtectedRoute permission={APP_PERMISSIONS.LOTES_PROCESS}><EmpaquetarLotePage /></ProtectedRoute>} />
            <Route path={ROUTES.DESPACHOS} element={<ProtectedRoute permission={APP_PERMISSIONS.DESPACHOS_VIEW}><DespachosPage /></ProtectedRoute>} />
            <Route path={ROUTES.DESPACHOS_NUEVO} element={<ProtectedRoute permission={APP_PERMISSIONS.LOTES_DISPATCH}><NuevoDespachoPage /></ProtectedRoute>} />
            <Route path={ROUTES.DESPACHOS_DETALLE} element={<ProtectedRoute permission={APP_PERMISSIONS.DESPACHOS_VIEW}><DetalleDespachoPage /></ProtectedRoute>} />
            <Route path={ROUTES.DESPACHOS_EDITAR} element={<ProtectedRoute permission={APP_PERMISSIONS.DESPACHOS_MANAGE}><NuevoDespachoPage /></ProtectedRoute>} />
            <Route
              path={ROUTES.CUBETAS}
              element={ENABLED_MODULES.CUBETAS ? <ProtectedRoute permission={APP_PERMISSIONS.DASHBOARD_VIEW}><CubetasPage /></ProtectedRoute> : <Navigate to={ROUTES.DASHBOARD} replace />}
            />
            <Route path={ROUTES.LIQUIDACIONES_AGRI} element={<ProtectedRoute permission={APP_PERMISSIONS.LIQUIDACIONES_AGRI_VIEW}><LiquidacionesAgriPage /></ProtectedRoute>} />
            <Route path={ROUTES.LIQUIDACIONES_AGRI_NUEVA} element={<ProtectedRoute permission={APP_PERMISSIONS.LIQUIDACIONES_AGRI_VIEW}><NuevaLiquidacionAgriPage /></ProtectedRoute>} />
            <Route path={ROUTES.LIQUIDACIONES_AGRI_DETALLE} element={<ProtectedRoute permission={APP_PERMISSIONS.LIQUIDACIONES_AGRI_VIEW}><DetalleLiquidacionAgriPage /></ProtectedRoute>} />
            <Route path={ROUTES.LIQUIDACIONES_AGRI_EDITAR} element={<ProtectedRoute permission={APP_PERMISSIONS.LIQUIDACIONES_AGRI_VIEW}><NuevaLiquidacionAgriPage /></ProtectedRoute>} />
            <Route path={ROUTES.PLANILLAS} element={<ProtectedRoute permission={APP_PERMISSIONS.PLANILLAS_VIEW}><PlanillasPage /></ProtectedRoute>} />
            <Route path={ROUTES.TAREO} element={<ProtectedRoute permission={APP_PERMISSIONS.DASHBOARD_VIEW}><TareoDiarioPage /></ProtectedRoute>} />
            <Route path={ROUTES.CONFIG_PRECIOS} element={<ProtectedRoute permission={APP_PERMISSIONS.CONFIG_PRECIOS_MANAGE}><ConfigPreciosPage /></ProtectedRoute>} />
            <Route path={ROUTES.CONFIG_PARAMETROS} element={<ProtectedRoute permission={APP_PERMISSIONS.CONFIG_PARAMETROS_MANAGE}><ConfigParametrosPage /></ProtectedRoute>} />
            <Route path={ROUTES.AUDIT_LOG} element={<ProtectedRoute permission={APP_PERMISSIONS.AUDIT_VIEW}><AuditLogPage /></ProtectedRoute>} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to={ROUTES.LOGIN} replace />} />
      </Routes>
    </BrowserRouter>
  )
}
