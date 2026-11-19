from drf_spectacular.utils import extend_schema
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.core.auditoria import registrar_actividad
from apps.core.models import LogActividad

from .serializers import LoginSerializer, PerfilSerializer, RegistroSerializer, UsuarioSerializer, tokens_para


@extend_schema(tags=['Autenticación'], summary='Registro de usuario', responses={201: UsuarioSerializer})
class RegistroView(generics.CreateAPIView):
    serializer_class = RegistroSerializer
    permission_classes = (permissions.AllowAny,)
    authentication_classes = ()

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        usuario = serializer.save()
        registrar_actividad(request, LogActividad.Accion.CREAR, usuario, usuario=usuario)
        cuerpo = {'usuario': UsuarioSerializer(usuario).data, **tokens_para(usuario)}
        return Response(cuerpo, status=status.HTTP_201_CREATED)


@extend_schema(tags=['Autenticación'], summary='Login (retorna access + refresh)')
class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer


@extend_schema(tags=['Autenticación'], summary='Renovar access token')
class RefreshView(TokenRefreshView):
    pass


@extend_schema(tags=['Autenticación'], summary='Perfil del usuario autenticado')
class PerfilView(generics.RetrieveUpdateAPIView):
    serializer_class = PerfilSerializer
    permission_classes = (permissions.IsAuthenticated,)
    http_method_names = ('get', 'put', 'patch', 'head', 'options')

    def get_object(self):
        return self.request.user

    def perform_update(self, serializer):
        usuario = serializer.save()
        registrar_actividad(
            self.request, LogActividad.Accion.EDITAR, usuario,
            detalle={'campos': sorted(serializer.validated_data)},
        )
