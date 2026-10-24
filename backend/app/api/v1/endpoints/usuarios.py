from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_password_hash
from app.models.usuario import Usuario
from app.schemas.usuario import UsuarioCreate, UsuarioUpdate, UsuarioResponse
from app.api.deps import get_current_admin, get_current_user

router = APIRouter()

@router.get("", response_model=List[UsuarioResponse])
def listar_usuarios(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_admin)
) -> Any:
    return db.query(Usuario).filter(Usuario.empresa_id == current_user.empresa_id).all()

@router.post("", response_model=UsuarioResponse)
def criar_usuario(
    usuario_in: UsuarioCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_admin)
) -> Any:
    usuario_existente = db.query(Usuario).filter(Usuario.email == usuario_in.email).first()
    if usuario_existente:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Já existe um usuário cadastrado com este e-mail."
        )

    novo_usuario = Usuario(
        empresa_id=current_user.empresa_id,
        nome=usuario_in.nome,
        email=usuario_in.email,
        hashed_password=get_password_hash(usuario_in.password),
        perfil=usuario_in.perfil,
        ativo=usuario_in.ativo,
        foto_url=usuario_in.foto_url
    )
    db.add(novo_usuario)
    db.commit()
    db.refresh(novo_usuario)
    return novo_usuario

@router.put("/{usuario_id}", response_model=UsuarioResponse)
def atualizar_usuario(
    usuario_id: int,
    usuario_in: UsuarioUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_admin)
) -> Any:
    usuario = db.query(Usuario).filter(
        Usuario.id == usuario_id,
        Usuario.empresa_id == current_user.empresa_id
    ).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    update_data = usuario_in.model_dump(exclude_unset=True)
    if "password" in update_data and update_data["password"]:
        usuario.hashed_password = get_password_hash(update_data.pop("password"))

    for field, value in update_data.items():
        setattr(usuario, field, value)

    db.add(usuario)
    db.commit()
    db.refresh(usuario)
    return usuario

