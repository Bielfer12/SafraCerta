from datetime import datetime, timedelta, timezone
from hashlib import sha256
from os import environ
from re import fullmatch

import firebase_admin
from firebase_admin import auth, firestore, storage
from fastapi import Header, HTTPException
from google.api_core.exceptions import PreconditionFailed


def configurar():
    try:
        firebase_admin.get_app()
    except ValueError:
        firebase_admin.initialize_app(options={
            'projectId': environ.get('GOOGLE_CLOUD_PROJECT', 'safracerta-ee9ce'),
            'storageBucket': environ.get('SAFRACERTA_STORAGE_BUCKET', 'safracerta-ee9ce.firebasestorage.app'),
        })
    return firestore.client()


def autenticar(authorization: str | None = Header(default=None)):
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(401, 'Entre na sua conta para analisar a folha.')
    try:
        return auth.verify_id_token(authorization[7:], check_revoked=True)
    except Exception:
        raise HTTPException(401, 'Sua sessão expirou ou foi encerrada. Entre novamente.')


def ativo(perfil):
    return perfil and perfil.get('tipoUsuario') in ('ADMIN', 'FUNCIONARIO') and perfil.get('statusConta') == 'ATIVO' and not perfil.get('cadastroPendente') and not perfil.get('exclusaoPendente')


def assumir(analise_id, uid, conteudo, modelo):
    if not fullmatch(r'[A-Za-z0-9_-]{10,128}', analise_id):
        raise HTTPException(400, 'Identificador da análise inválido.')
    banco = configurar()
    referencia = banco.document(f'analises/{analise_id}')
    assinatura = sha256(conteudo).hexdigest()

    @firestore.transactional
    def executar(transacao):
        perfil = banco.document(f'usuarios/{uid}').get(transaction=transacao).to_dict()
        atual = referencia.get(transaction=transacao).to_dict()
        if not ativo(perfil) or not atual or atual['usuarioId'] != uid:
            raise HTTPException(403, 'Seu acesso a esta análise não está disponível.')
        if atual['foto'].get('sha256') and atual['foto']['sha256'] != assinatura:
            raise HTTPException(409, 'Esta tentativa já recebeu outra imagem. Inicie uma nova análise.')
        if atual['status'] != 'AGUARDANDO_ENVIO':
            return atual
        agora = datetime.now(timezone.utc)
        if atual['expiraEm'] <= agora:
            raise HTTPException(409, 'Esta tentativa expirou. Inicie outra análise.')
        transacao.update(referencia, {
            'status': 'EM_PROCESSAMENTO', 'iniciadoEm': firestore.SERVER_TIMESTAMP,
            'atualizadoEm': firestore.SERVER_TIMESTAMP, 'expiraEm': agora + timedelta(minutes=10),
            'foto.sha256': assinatura, 'modelo': modelo,
        })
        return None

    return executar(banco.transaction())


def atualizar(analise_id, assinatura, valores, permitir_encerrada=False):
    banco = configurar()
    referencia = banco.document(f'analises/{analise_id}')

    @firestore.transactional
    def executar(transacao):
        atual = referencia.get(transaction=transacao).to_dict()
        if not atual or atual['foto'].get('sha256') != assinatura:
            raise HTTPException(409, 'A tentativa não corresponde à imagem enviada.')
        if atual['status'] != 'EM_PROCESSAMENTO':
            if permitir_encerrada and atual['foto'].get('situacao') == 'PENDENTE':
                transacao.update(referencia, {**valores, 'atualizadoEm': firestore.SERVER_TIMESTAMP})
            return False
        alteracoes = {**valores, 'atualizadoEm': firestore.SERVER_TIMESTAMP}
        if valores.get('status') == 'FALHOU' and atual['foto'].get('situacao') != 'SALVA':
            alteracoes['foto.situacao'] = 'FALHA'
        transacao.update(referencia, alteracoes)
        return True

    if not executar(banco.transaction()):
        raise HTTPException(409, 'Esta tentativa já foi encerrada. Consulte o histórico.')


def salvar_foto(analise_id, uid, conteudo, formato, dimensoes):
    extensao, tipo = {'JPEG': ('jpg', 'image/jpeg'), 'PNG': ('png', 'image/png'), 'WEBP': ('webp', 'image/webp')}[formato]
    assinatura = sha256(conteudo).hexdigest()
    caminho = f'analises/{uid}/{analise_id}/foto.{extensao}'
    foto = {'situacao': 'PENDENTE', 'caminho': caminho, 'geracao': None, 'tipoMime': tipo,
            'tamanhoBytes': len(conteudo), 'largura': dimensoes[0], 'altura': dimensoes[1], 'sha256': assinatura}
    atualizar(analise_id, assinatura, {'foto': foto})
    arquivo = storage.bucket().blob(caminho)
    arquivo.metadata = {'sha256': assinatura}
    try:
        arquivo.upload_from_string(conteudo, content_type=tipo, if_generation_match=0, timeout=60)
    except PreconditionFailed:
        arquivo.reload()
        if (arquivo.metadata or {}).get('sha256') != assinatura:
            raise HTTPException(409, 'A foto desta tentativa já existe com outro conteúdo.')
    foto.update(situacao='SALVA', geracao=str(arquivo.generation))
    atualizar(analise_id, assinatura, {'foto': foto}, permitir_encerrada=True)


def finalizar(analise_id, conteudo, resultado, duracao_ms):
    atualizar(analise_id, sha256(conteudo).hexdigest(), {
        'status': 'CONCLUIDA', 'resultado': resultado, 'erro': None,
        'finalizadoEm': firestore.SERVER_TIMESTAMP, 'duracaoProcessamentoMs': duracao_ms,
    })


def falhar(analise_id, conteudo, codigo, etapa, mensagem, duracao_ms):
    atualizar(analise_id, sha256(conteudo).hexdigest(), {
        'status': 'FALHOU', 'erro': {'codigo': codigo, 'etapa': etapa, 'mensagem': mensagem},
        'resultado': None, 'finalizadoEm': firestore.SERVER_TIMESTAMP, 'duracaoProcessamentoMs': duracao_ms,
    })
