from contextlib import asynccontextmanager
from io import BytesIO
from math import isfinite
from os import environ
from pathlib import Path
from threading import Lock
from typing import Literal
import logging
import warnings

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError
from pydantic import BaseModel, Field
PIL_OPEN = Image.open  # Preserva o leitor antes dos patches da Ultralytics.
from ultralytics import YOLO

MODELOS_DIR = Path(environ.get('SAFRACERTA_MODELOS_DIR', Path(__file__).resolve().parents[2] / 'modelos')).expanduser().resolve()
CLASSIFICADOR_PATH = MODELOS_DIR / 'best_classificao.pt'
DETECTOR_PATH = MODELOS_DIR / 'best_deteccao.pt'
LESOES_PATH = Path(environ['SAFRACERTA_MODELO_LESOES']).expanduser().resolve() if environ.get('SAFRACERTA_MODELO_LESOES') else None
MAX_BYTES = 10 * 1024 * 1024
MAX_PIXELS = 25_000_000
logger = logging.getLogger('safracerta')

class Previsao(BaseModel):
    classe_id: int
    classe: str
    nome_exibicao: str
    pontuacao: float

class Marcacao(BaseModel):
    id: int
    classe: str
    pontuacao: float = Field(ge=0, le=1)
    caixa_xyxyn: list[float] = Field(min_length=4, max_length=4)

class Localizacao(BaseModel):
    estado: Literal['concluido', 'nao_disponivel', 'erro']
    itens: list[Marcacao] = Field(default_factory=list)

class Dimensoes(BaseModel):
    largura: int
    altura: int

class Analise(Previsao):
    top3: list[Previsao]
    modelo: str = 'YOLO26n-cls'
    versao_resposta: int = 2
    imagem: Dimensoes
    fonte_classificacao: str = 'imagem_completa'
    deteccao_folha: Localizacao
    deteccao_lesoes: Localizacao
    aviso: str = 'Resultado experimental. A caixa da folha não indica a localização da doença. A pontuação não garante acerto.'

@asynccontextmanager
async def lifespan(app: FastAPI):
    for caminho in [CLASSIFICADOR_PATH, DETECTOR_PATH] + ([LESOES_PATH] if LESOES_PATH else []):
        if not caminho.is_file():
            raise RuntimeError(f'Modelo não encontrado: {caminho}')
    app.state.modelo = YOLO(str(CLASSIFICADOR_PATH))
    if app.state.modelo.task != 'classify':
        raise RuntimeError('Este serviço exige um modelo de classificação.')
    app.state.detector = YOLO(str(DETECTOR_PATH))
    if app.state.detector.task != 'detect' or set(app.state.detector.names.values()) != {'folha'}:
        raise RuntimeError('O detector deve localizar somente a classe folha.')
    app.state.lesoes = YOLO(str(LESOES_PATH)) if LESOES_PATH else None
    if app.state.lesoes and (app.state.lesoes.task != 'detect' or set(app.state.lesoes.names.values()) != {'lesao'}):
        raise RuntimeError('O detector de lesões deve ter a classe lesao; não utilize o peso de folhas.')
    app.state.lock = Lock()
    yield
    del app.state.modelo
    del app.state.detector
    del app.state.lesoes

app = FastAPI(title='SafraCerta API', version='2.0.0', lifespan=lifespan)

@app.get('/saude')
def saude(request: Request):
    return {
        'status': 'ok',
        'modelo_carregado': True,
        'detector_folha_carregado': True,
        'detector_lesoes_carregado': request.app.state.lesoes is not None,
        'versao_resposta': 2,
    }

@app.get('/classes')
def classes(request: Request):
    return [{'classe_id': int(i), 'classe': name} for i, name in request.app.state.modelo.names.items()]

def abrir_imagem(conteudo: bytes) -> Image.Image:
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            with PIL_OPEN(BytesIO(conteudo)) as image:
                if image.format not in {'JPEG', 'PNG', 'WEBP'}:
                    raise HTTPException(415, 'Envie uma imagem JPEG, PNG ou WebP.')
                if image.width * image.height > MAX_PIXELS:
                    raise HTTPException(413, 'Imagem excede 25 milhões de pixels.')
                image.load()
                return ImageOps.exif_transpose(image).convert('RGB')
    except HTTPException:
        raise
    except (Image.DecompressionBombWarning, Image.DecompressionBombError):
        raise HTTPException(413, 'Imagem grande demais.')
    except (UnidentifiedImageError, OSError, ValueError):
        raise HTTPException(400, 'Arquivo inválido ou imagem corrompida.')

def detectar(modelo, imagem: Image.Image, limite: int) -> list[Marcacao]:
    resultado = modelo.predict(source=imagem, imgsz=640, conf=0.25, max_det=limite, device='cpu', verbose=False, save=False)[0]
    if resultado.boxes is None:
        raise RuntimeError('O detector não retornou caixas.')
    largura, altura = imagem.size
    marcacoes = []
    for caixa in resultado.boxes:
        valores = caixa.xyxy[0].cpu().tolist()
        pontuacao = float(caixa.conf.item())
        if not all(isfinite(valor) for valor in valores) or not isfinite(pontuacao):
            raise RuntimeError('O detector retornou coordenadas inválidas.')
        x1, y1, x2, y2 = [max(0.0, min(1.0, valor / tamanho)) for valor, tamanho in zip(valores, [largura, altura, largura, altura])]
        if x2 <= x1 or y2 <= y1:
            continue
        marcacoes.append(Marcacao(
            id=len(marcacoes) + 1,
            classe=resultado.names[int(caixa.cls.item())],
            pontuacao=pontuacao,
            caixa_xyxyn=[x1, y1, x2, y2],
        ))
    return marcacoes

def selecionar_folha(marcacoes: list[Marcacao]) -> Marcacao:
    if not marcacoes:
        raise HTTPException(422, 'Não foi possível localizar uma folha. Aproxime a câmera de uma única folha e tente novamente.')
    candidatas = sorted(marcacoes, key=lambda item: item.pontuacao, reverse=True)
    principal = candidatas[0]
    x1, y1, x2, y2 = principal.caixa_xyxyn
    area_principal = (x2 - x1) * (y2 - y1)
    for candidata in candidatas[1:]:
        a1, b1, a2, b2 = candidata.caixa_xyxyn
        intersecao = max(0, min(x2, a2) - max(x1, a1)) * max(0, min(y2, b2) - max(y1, b1))
        uniao = area_principal + (a2 - a1) * (b2 - b1) - intersecao
        if intersecao / uniao < 0.7:
            raise HTTPException(422, 'Mais de uma região de folha foi encontrada. Fotografe uma única folha mais de perto.')
    return principal.model_copy(update={'id': 1})

@app.post('/analisar', response_model=Analise)
def analisar(request: Request, foto: UploadFile = File(...)):
    try:
        conteudo = foto.file.read(MAX_BYTES + 1)
    finally:
        foto.file.close()
    if not conteudo:
        raise HTTPException(400, 'A foto está vazia.')
    if len(conteudo) > MAX_BYTES:
        raise HTTPException(413, 'A foto deve ter no máximo 10 MB.')
    image = abrir_imagem(conteudo)
    try:
        with request.app.state.lock:
            folha = selecionar_folha(detectar(request.app.state.detector, image, 20))
            model = request.app.state.modelo
            result = model.predict(source=image, imgsz=224, device='cpu', verbose=False, save=False)[0]
            if result.probs is None:
                raise RuntimeError('Modelo não retornou classificação.')
            scores = result.probs.data.cpu().tolist()
            lesoes = Localizacao(estado='nao_disponivel')
            if request.app.state.lesoes is not None:
                try:
                    lesoes = Localizacao(estado='concluido', itens=detectar(request.app.state.lesoes, image, 50))
                except Exception:
                    logger.exception('Falha na localização de lesões')
                    lesoes = Localizacao(estado='erro')
        ids = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:3]
        def item(i):
            name = model.names[i]
            return Previsao(classe_id=i, classe=name,
                            nome_exibicao='Saudável' if name == 'healthy' else name,
                            pontuacao=float(scores[i]))
        top3 = [item(i) for i in ids]
        return Analise(
            **top3[0].model_dump(),
            top3=top3,
            imagem=Dimensoes(largura=image.width, altura=image.height),
            deteccao_folha=Localizacao(estado='concluido', itens=[folha]),
            deteccao_lesoes=lesoes,
        )
    except HTTPException:
        raise
    except Exception:
        logger.exception('Falha na inferência')
        raise HTTPException(500, 'Não foi possível analisar a imagem.')
    finally:
        image.close()
