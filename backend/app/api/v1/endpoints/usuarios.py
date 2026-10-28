from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_password_hash
from app.models.usuario import Usuario, PerfilUsuario
from app.models.caixa import Caixa, StatusCaixa
from app.models.venda import Venda
from app.models.estoque import MovimentacaoEstoque
from app.models.ponto import RegistroPonto, ConfiguracaoPonto
from app.schemas.usuario import UsuarioCreate, UsuarioUpdate, UsuarioPerfilUpdate, UsuarioResponse
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
    if len(usuario_in.password.strip()) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A senha deve possuir no mínimo 6 caracteres."
        )

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

@router.get("/me", response_model=UsuarioResponse)
def obter_meu_perfil(
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    """Retorna os dados do usuário atualmente autenticado"""
    return current_user

@router.put("/me", response_model=UsuarioResponse)
def atualizar_proprio_perfil(
    perfil_in: UsuarioPerfilUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Any:
    """Permite que qualquer colaborador autenticado altere seu nome, e-mail, senha e foto de perfil"""
    if perfil_in.nome is not None and perfil_in.nome.strip():
        current_user.nome = perfil_in.nome.strip()

    if perfil_in.email is not None and perfil_in.email != current_user.email:
        em_uso = db.query(Usuario).filter(
            Usuario.email == perfil_in.email,
            Usuario.id != current_user.id
        ).first()
        if em_uso:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Este e-mail já está sendo utilizado por outro usuário."
            )
        current_user.email = perfil_in.email

    if perfil_in.foto_url is not None:
        current_user.foto_url = perfil_in.foto_url

    if perfil_in.password and str(perfil_in.password).strip():
        nova_senha = str(perfil_in.password).strip()
        if len(nova_senha) < 6:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A nova senha deve possuir no mínimo 6 caracteres."
            )
        current_user.hashed_password = get_password_hash(nova_senha)

    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user

@router.put("/{usuario_id}", response_model=UsuarioResponse)
def atualizar_usuario(
    usuario_id: int,
    usuario_in: UsuarioUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_admin)
) -> Any:
    # 1. Busca por ID exato e empresa
    usuario = db.query(Usuario).filter(
        Usuario.id == usuario_id,
        Usuario.empresa_id == current_user.empresa_id
    ).first()

    # 2. Tolerância para IDs de 64-bit do CockroachDB sujeitos a arredondamento IEEE-754 float64 no frontend
    if not usuario and usuario_id and usuario_id > 10_000_000:
        usuario = db.query(Usuario).filter(
            Usuario.empresa_id == current_user.empresa_id,
            Usuario.id.between(usuario_id - 1000, usuario_id + 1000)
        ).first()

    # 3. Fallback inteligente por e-mail na mesma empresa
    if not usuario and usuario_in.email:
        usuario = db.query(Usuario).filter(
            Usuario.empresa_id == current_user.empresa_id,
            Usuario.email == usuario_in.email
        ).first()

    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    # Impede conflito de e-mail duplicado caso seja alterado
    if usuario_in.email and usuario_in.email != usuario.email:
        email_em_uso = db.query(Usuario).filter(
            Usuario.email == usuario_in.email,
            Usuario.id != usuario.id
        ).first()
        if email_em_uso:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Já existe outro colaborador cadastrado com este e-mail."
            )

    update_data = usuario_in.model_dump(exclude_unset=True)
    if "password" in update_data:
        nova_senha = update_data.pop("password")
        if nova_senha and str(nova_senha).strip():
            senha_limpa = str(nova_senha).strip()
            if len(senha_limpa) < 6:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="A nova senha deve possuir no mínimo 6 caracteres."
                )
            usuario.hashed_password = get_password_hash(senha_limpa)

    for field, value in update_data.items():
        setattr(usuario, field, value)

    db.add(usuario)
    db.commit()
    db.refresh(usuario)
    return usuario

@router.delete("/{usuario_id}")
def excluir_usuario(
    usuario_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_admin)
) -> Any:
    # 1. Busca por ID exato
    usuario = db.query(Usuario).filter(
        Usuario.id == usuario_id,
        Usuario.empresa_id == current_user.empresa_id
    ).first()

    # 2. Tolerância para IDs de 64-bit do CockroachDB
    if not usuario and usuario_id and usuario_id > 10_000_000:
        usuario = db.query(Usuario).filter(
            Usuario.empresa_id == current_user.empresa_id,
            Usuario.id.between(usuario_id - 1000, usuario_id + 1000)
        ).first()

    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    if current_user.id == usuario.id or (current_user.id > 10_000_000 and abs(current_user.id - usuario.id) <= 1000):
        raise HTTPException(
            status_code=400,
            detail="Operação não permitida: Você não pode excluir seu próprio usuário logado."
        )

    # Impede exclusão do último administrador ativo
    if usuario.perfil == PerfilUsuario.ADMIN:
        outros_admins = db.query(Usuario).filter(
            Usuario.empresa_id == current_user.empresa_id,
            Usuario.perfil == PerfilUsuario.ADMIN,
            Usuario.id != usuario.id,
            Usuario.ativo == True
        ).count()
        if outros_admins == 0:
            raise HTTPException(
                status_code=400,
                detail="Operação bloqueada: Não é possível excluir o único administrador ativo da empresa."
            )

    # Impede exclusão se o usuário estiver com caixa aberto
    caixa_aberto = db.query(Caixa).filter(
        Caixa.usuario_id == usuario.id,
        Caixa.status == StatusCaixa.ABERTO
    ).first()
    if caixa_aberto:
        raise HTTPException(
            status_code=400,
            detail=f"Não é possível excluir o usuário '{usuario.nome}' pois ele possui o Caixa #{caixa_aberto.id} aberto no momento. Feche o caixa antes de prosseguir."
        )

    # Remove escalas de trabalho personalizadas vinculadas a ele
    db.query(ConfiguracaoPonto).filter(ConfiguracaoPonto.usuario_id == usuario.id).delete()

    tem_vendas = db.query(Venda).filter(Venda.usuario_id == usuario.id).count() > 0
    tem_caixas = db.query(Caixa).filter(Caixa.usuario_id == usuario.id).count() > 0
    tem_mov_estoque = db.query(MovimentacaoEstoque).filter(MovimentacaoEstoque.usuario_id == usuario.id).count() > 0

    if tem_vendas or tem_caixas or tem_mov_estoque:
        # Se tem histórico contábil/fiscal, desativa o usuário para manter rastreabilidade
        usuario.ativo = False
        db.commit()
        return {
            "ok": True,
            "tipo": "desativado",
            "mensagem": f"O usuário '{usuario.nome}' possui movimentações financeiras/contábeis registradas e seu acesso foi inativado para preservar o histórico de auditoria."
        }

    # Se não tem histórico contábil, remove registros de ponto e o usuário fisicamente
    db.query(RegistroPonto).filter(RegistroPonto.usuario_id == usuario.id).delete()
    db.delete(usuario)
    db.commit()
    return {
        "ok": True,
        "tipo": "excluido",
        "mensagem": f"Usuário '{usuario.nome}' excluído com sucesso do sistema."
    }

