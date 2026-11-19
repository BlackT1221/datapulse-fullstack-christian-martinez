from django.contrib.auth import password_validation
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import exceptions, serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from apps.core.auditoria import registrar_actividad
from apps.core.models import LogActividad

from .models import Usuario

ROLES_AUTOREGISTRO = (Usuario.Rol.ANALISTA, Usuario.Rol.VIEWER)


class UsuarioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Usuario
        fields = ('id', 'email', 'nombre_completo', 'rol', 'activo', 'fecha_creacion')
        read_only_fields = fields


def tokens_para(usuario):
    refresh = RefreshToken.for_user(usuario)
    return {'access': str(refresh.access_token), 'refresh': str(refresh)}


class RegistroSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, style={'input_type': 'password'})
    password_confirmacion = serializers.CharField(write_only=True, style={'input_type': 'password'})
    rol = serializers.ChoiceField(choices=Usuario.Rol.choices, default=Usuario.Rol.VIEWER)

    class Meta:
        model = Usuario
        fields = ('email', 'nombre_completo', 'rol', 'password', 'password_confirmacion')
        extra_kwargs = {'nombre_completo': {'required': True, 'allow_blank': False}}

    def validate_email(self, valor):
        valor = Usuario.objects.normalize_email(valor).lower()
        if Usuario.objects.filter(email__iexact=valor).exists():
            raise serializers.ValidationError('Ya existe un usuario registrado con este correo electrónico.')
        return valor

    def validate_rol(self, valor):
        if valor not in ROLES_AUTOREGISTRO:
            raise serializers.ValidationError('Solo es posible registrarse como ANALISTA o VIEWER.')
        return valor

    def validate(self, attrs):
        if attrs['password'] != attrs.pop('password_confirmacion'):
            raise serializers.ValidationError({'password_confirmacion': 'Las contraseñas no coinciden.'})
        candidato = Usuario(email=attrs['email'], nombre_completo=attrs.get('nombre_completo', ''))
        try:
            password_validation.validate_password(attrs['password'], user=candidato)
        except DjangoValidationError as error:
            raise serializers.ValidationError({'password': list(error.messages)})
        return attrs

    def create(self, validated_data):
        password = validated_data.pop('password')
        return Usuario.objects.create_user(password=password, **validated_data)


class LoginSerializer(TokenObtainPairSerializer):
    default_error_messages = {
        'no_active_account': 'Credenciales inválidas o cuenta inactiva.',
    }

    def validate(self, attrs):
        data = super().validate(attrs)
        if not self.user.activo:
            raise exceptions.AuthenticationFailed(self.error_messages['no_active_account'])
        data['usuario'] = UsuarioSerializer(self.user).data
        registrar_actividad(
            self.context.get('request'), LogActividad.Accion.LOGIN, self.user, usuario=self.user,
        )
        return data


class PerfilSerializer(serializers.ModelSerializer):
    """Perfil propio: solo `nombre_completo` es editable; email y rol los gestiona un ADMIN."""

    class Meta:
        model = Usuario
        fields = ('id', 'email', 'nombre_completo', 'rol', 'activo', 'fecha_creacion')
        read_only_fields = ('id', 'email', 'rol', 'activo', 'fecha_creacion')
        extra_kwargs = {'nombre_completo': {'allow_blank': False}}
