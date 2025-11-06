"""
相似度分数融合模块
使用 Min-Max 或 Z-score 归一化，然后加权融合文本和图像相似度分数
"""
from __future__ import annotations

from typing import List, Tuple
import numpy as np


def normalize_scores(scores: List[float], method: str = "minmax") -> List[float]:
    """
    归一化相似度分数
    
    Args:
        scores: 相似度分数列表
        method: 归一化方法，"minmax" 或 "zscore"
    
    Returns:
        归一化后的分数列表
    """
    if not scores:
        return []
    
    scores_arr = np.asarray(scores, dtype=float)
    
    if method == "minmax":
        # Min-Max 归一化到 [0, 1]
        min_score = scores_arr.min()
        max_score = scores_arr.max()
        if max_score == min_score:
            return [0.0] * len(scores)
        normalized = (scores_arr - min_score) / (max_score - min_score)
        return normalized.tolist()
    
    elif method == "zscore":
        # Z-score 归一化（标准化）
        mean_score = scores_arr.mean()
        std_score = scores_arr.std()
        if std_score == 0:
            return [0.0] * len(scores)
        normalized = (scores_arr - mean_score) / std_score
        # 缩放到 [0, 1] 范围
        min_norm = normalized.min()
        max_norm = normalized.max()
        if max_norm == min_norm:
            return [0.0] * len(scores)
        scaled = (normalized - min_norm) / (max_norm - min_norm)
        return scaled.tolist()
    
    else:
        # 默认不归一化
        return scores


def fuse_similarity_scores(
    text_sim: float,
    image_sim: float,
    weights: Tuple[float, float] = (0.6, 0.4),
    has_text: bool = True,
    has_image: bool = True,
) -> float:
    """
    融合文本和图像相似度分数
    
    Args:
        text_sim: 文本相似度分数
        image_sim: 图像相似度分数
        weights: 融合权重 (text_weight, image_weight)
        has_text: 是否有文本向量
        has_image: 是否有图像向量
    
    Returns:
        融合后的相似度分数
    """
    # 如果只有文本或只有图像，使用单一相似度
    if has_text and not has_image:
        return text_sim
    elif has_image and not has_text:
        return image_sim
    elif not has_text and not has_image:
        return 0.0
    
    # 两者都有，加权融合
    wt, wi = weights
    return wt * text_sim + wi * image_sim


def cosine_similarity(a: List[float], b: List[float], verbose: bool = False) -> float:
    """
    计算两个向量的余弦相似度
    
    Args:
        a: 向量A
        b: 向量B
        verbose: 是否打印详细日志
    
    Returns:
        余弦相似度分数 [0, 1]
    """
    va, vb = np.asarray(a, dtype=float), np.asarray(b, dtype=float)
    
    # 检查维度是否匹配
    if len(va) != len(vb):
        if verbose:
            print(f"[Cosine] WARNING: Dimension mismatch ({len(va)} vs {len(vb)})")
        return 0.0
    
    na, nb = np.linalg.norm(va), np.linalg.norm(vb)
    if na == 0 or nb == 0:
        if verbose:
            print(f"[Cosine] Zero norm detected: na={na:.10f}, nb={nb:.10f}")
        return 0.0
    
    dot_product = np.dot(va, vb)
    similarity = float(dot_product / (na * nb))
    
    if verbose:
        print(f"[Cosine] Similarity: {similarity:.10f} (dot={dot_product:.6f}, na={na:.6f}, nb={nb:.6f})")
    
    return similarity
