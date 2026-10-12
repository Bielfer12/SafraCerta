"""API local de classificação de folhas. Execute pelo iniciar_windows.bat."""
from contextlib import asynccontextmanager
from io import BytesIO
from pathlib import Path
from threading import Lock
import logging
import warnings

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError
from pydantic import BaseModel
PIL_OPEN = Image.open  # Preserva o leitor antes dos patches da Ultralytics.
from ultralytics import YOLO

MODEL_PATH = Path(__file__).resolve().parent / 'modelos' / 'best.pt'
MAX_BYTES = 10 * 1024 * 1024
MAX_PIXELS = 25_000_000
logger = logging.getLogger('safracerta')

class Previsao(BaseModel):
    classe_id: int
    classe: str
    nome_exibicao: str
    pontuacao: float

class Analise(Previsao):
    top3: list[Previsao]
    modelo: str = 'YOLO26n-cls'
    aviso: str = 'Previsão experimental. A pontuação não garante acerto nem valida que a foto seja de uma folha de fumo.'

@asynccontextmanager
async def lifespan(app: FastAPI):
    if not MODEL_PATH.is_file():
        raise RuntimeError(f'Modelo não encontrado: {MODEL_PATH}')
    app.state.modelo = YOLO(str(MODEL_PATH), task='classify')
    if app.state.modelo.task != 'classify':
        raise RuntimeError('Este serviço exige um modelo de classificação.')
    app.state.lock = Lock()
    yield
    del app.state.modelo

app = FastAPI(title='SafraCerta API', version='1.0.0', lifespan=lifespan)

@app.get('/saude')
def saude():
    return {'status': 'ok', 'modelo_carregado': True}

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
    model = request.app.state.modelo
    # Evita acesso simultâneo ao mesmo preditor. Rota síncrona roda no thread pool.
    try:
        with request.app.state.lock:
            result = model.predict(source=image, imgsz=224, device='cpu', verbose=False, save=False)[0]
            if result.probs is None:
                raise RuntimeError('Modelo não retornou classificação.')
            scores = result.probs.data.cpu().tolist()
        ids = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:3]
        def item(i):
            name = model.names[i]
            return Previsao(classe_id=i, classe=name,
                            nome_exibicao='Saudável' if name == 'healthy' else name,
                            pontuacao=float(scores[i]))
        top3 = [item(i) for i in ids]
        return Analise(**top3[0].model_dump(), top3=top3)
    except Exception:
        logger.exception('Falha na inferência')
        raise HTTPException(500, 'Não foi possível analisar a imagem.')
    finally:
        image.close()
