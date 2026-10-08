"""Exporta o classificador YOLO para TFLite e compara as inferencias.

Uso:
    python exportar_e_comparar.py

Dependencias:
    pip install ultralytics tensorflow pillow pandas
"""

from pathlib import Path
import platform
import shutil

import numpy as np
import pandas as pd
import tensorflow as tf
from PIL import Image
from ultralytics import YOLO


ROOT = Path(__file__).resolve().parent
MODEL_PATH = ROOT / "treinamento" / "weights" / "best.pt"
TEST_DIR = ROOT / "dataset_test"
FIELD_DIR = ROOT / "campo"
TFLITE_PATH = ROOT / "SafraCerta_classificador_float32.tflite"


def class_names(model: YOLO) -> list[str]:
    return [model.names[index] for index in range(len(model.names))]


def image_paths(folder: Path) -> list[Path]:
    extensions = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
    return sorted(
        path for path in folder.rglob("*")
        if path.is_file() and path.suffix.lower() in extensions
    )


def predict_pt(model: YOLO, paths: list[Path], names: list[str]) -> pd.DataFrame:
    rows = []
    for result in model.predict(
        source=[str(path) for path in paths],
        imgsz=224,
        stream=True,
        verbose=False,
    ):
        top1 = int(result.probs.top1)
        rows.append(
            {
                "imagem": result.path,
                "id_previsto_pt": top1,
                "classe_prevista_pt": names[top1],
                "confianca_pt": float(result.probs.top1conf.item()),
            }
        )
    return pd.DataFrame(rows)


def predict_tflite(interpreter: tf.lite.Interpreter, path: Path) -> tuple[int, np.ndarray]:
    input_details = interpreter.get_input_details()[0]
    output_details = interpreter.get_output_details()[0]
    image = Image.open(path).convert("RGB").resize((224, 224))
    tensor = np.asarray(image)

    if input_details["dtype"] == np.float32:
        tensor = tensor.astype(np.float32) / 255.0
    elif input_details["dtype"] == np.uint8:
        tensor = tensor.astype(np.uint8)
    elif input_details["dtype"] == np.int8:
        scale, zero_point = input_details["quantization"]
        if scale == 0:
            raise ValueError("Entrada int8 sem escala de quantizacao.")
        tensor = np.round(tensor / 255.0 / scale + zero_point).astype(np.int8)
    else:
        raise TypeError(f"Tipo de entrada TFLite nao suportado: {input_details['dtype']}")

    interpreter.set_tensor(input_details["index"], np.expand_dims(tensor, axis=0))
    interpreter.invoke()
    values = interpreter.get_tensor(output_details["index"])[0]

    scale, zero_point = output_details["quantization"]
    if scale:
        values = (values.astype(np.float32) - zero_point) * scale

    return int(np.argmax(values)), values.astype(np.float32)


def export_tflite(model: YOLO) -> Path:
    if platform.system() != "Windows":
        exported = model.export(format="tflite", imgsz=224)
        return Path(exported)

    saved_model_dir = Path(model.export(format="saved_model", imgsz=224))
    exported = saved_model_dir / "best_float32.tflite"
    if not exported.is_file():
        raise FileNotFoundError(
            f"Exportacao SavedModel nao gerou o arquivo esperado: {exported}"
        )
    return exported


def main() -> None:
    model = YOLO(str(MODEL_PATH))
    names = class_names(model)
    (ROOT / "classes.txt").write_text("\n".join(names) + "\n", encoding="utf-8")

    exported_path = export_tflite(model)
    shutil.copyfile(exported_path, TFLITE_PATH)

    interpreter = tf.lite.Interpreter(model_path=str(TFLITE_PATH))
    interpreter.allocate_tensors()
    input_details = interpreter.get_input_details()[0]
    output_details = interpreter.get_output_details()[0]

    paths = image_paths(TEST_DIR) if TEST_DIR.exists() else []
    if paths:
        pt = predict_pt(model, paths, names)
        tflite_rows = []
        for path in paths:
            top1, values = predict_tflite(interpreter, path)
            tflite_rows.append(
                {
                    "imagem": str(path),
                    "id_previsto_tflite": top1,
                    "classe_prevista_tflite": names[top1],
                    "confianca_tflite": float(values[top1]),
                }
            )
        comparison = pt.merge(pd.DataFrame(tflite_rows), on="imagem")
        comparison["mesma_classe"] = (
            comparison["id_previsto_pt"] == comparison["id_previsto_tflite"]
        )
        comparison.to_csv(ROOT / "comparacao_pt_tflite.csv", index=False)

    field_paths = image_paths(FIELD_DIR) if FIELD_DIR.exists() else []
    if field_paths:
        field_rows = []
        for path in field_paths:
            top1, values = predict_tflite(interpreter, path)
            field_rows.append(
                {
                    "imagem": str(path),
                    "classe_prevista": names[top1],
                    "id_previsto": top1,
                    "confianca": float(values[top1]),
                }
            )
        pd.DataFrame(field_rows).to_csv(ROOT / "previsoes_campo.csv", index=False)

    print("TFLite:", TFLITE_PATH)
    print("Entrada:", input_details["shape"].tolist(), input_details["dtype"].__name__)
    print("Saida:", output_details["shape"].tolist(), output_details["dtype"].__name__)
    print("Classes:", names)


if __name__ == "__main__":
    main()
