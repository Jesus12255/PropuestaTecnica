"""
Endpoints de autenticación.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.dependencies import get_current_user
from core.services.auth import (
    authenticate_user,
    create_access_token,
    create_user,
    get_user_by_email,
)
from core.services.storage_service import init_user_storage
from models.user import User
from models.schemas.auth_schemas import (
    UserCreate,
    UserLogin,
    UserResponse,
    Token,
    UpdatePreferencesRequest,
    UserPreferences,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Registra un nuevo usuario.
    """
    # Verificar si el email ya existe
    existing_user = await get_user_by_email(db, user_data.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El email ya está registrado",
        )
    
    # Crear usuario
    user = await create_user(
        db=db,
        email=user_data.email,
        password=user_data.password,
        full_name=user_data.full_name,
    )
    
    # Inicializar almacenamiento del usuario
    await init_user_storage(db, user)
    
    await db.commit()
    await db.refresh(user)
    
    # Generar token
    access_token = create_access_token(user.id)
    
    return Token(
        access_token=access_token,
        user=UserResponse.model_validate(user),
    )


@router.post("/login", response_model=Token)
async def login(
    credentials: UserLogin,
    db: AsyncSession = Depends(get_db),
):
    """
    Inicia sesión y retorna un token JWT.
    """
    user = await authenticate_user(db, credentials.email, credentials.password)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario inactivo",
        )
    
    # Generar token
    access_token = create_access_token(user.id)
    
    return Token(
        access_token=access_token,
        user=UserResponse.model_validate(user),
    )


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: User = Depends(get_current_user),
):
    """
    Obtiene la información del usuario actual.
    """
    return UserResponse.model_validate(current_user)


@router.get("/preferences", response_model=UserPreferences)
async def get_preferences(
    current_user: User = Depends(get_current_user),
):
    """
    Obtiene las preferencias del usuario actual.
    """
    if current_user.preferences:
        return UserPreferences(**current_user.preferences)
    return UserPreferences(analysis_mode="balanced")


@router.put("/preferences", response_model=UserPreferences)
async def update_preferences(
    preferences: UpdatePreferencesRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Actualiza las preferencias del usuario.
    
    Modos de análisis disponibles:
    - fast: Análisis rápido (~15s)
    - balanced: Análisis completo (~30s) - Recomendado
    - deep: Análisis exhaustivo (~60s)
    """
    current_user.preferences = {"analysis_mode": preferences.analysis_mode}
    await db.commit()
    await db.refresh(current_user)
    
    return UserPreferences(**current_user.preferences)


@router.post("/refresh", response_model=Token)
async def refresh_token(
    current_user: User = Depends(get_current_user),
):
    """
    Refresca el token JWT.
    """
    access_token = create_access_token(current_user.id)
    
    return Token(
        access_token=access_token,
        user=UserResponse.model_validate(current_user),
    )
