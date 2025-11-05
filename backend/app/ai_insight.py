"""
AI 洞察模块 - 使用通义千问分析 OpenGraph 数据
"""
import os
import dashscope
from typing import List, Dict
from dotenv import load_dotenv
from ai_prompts import build_messages

# 加载环境变量
load_dotenv()

# 配置 API Key
dashscope.api_key = os.getenv("DASHSCOPE_API_KEY", "")


def analyze_opengraph_data(opengraph_items: List[Dict]) -> Dict:
    """
    使用通义千问分析 OpenGraph 数据并生成总结
    
    Args:
        opengraph_items: OpenGraph 数据列表，每个元素包含 url, title, description, image, site_name 等
    
    Returns:
        包含总结的字典
    """
    if not dashscope.api_key:
        return {
            "success": False,
            "error": "DASHSCOPE_API_KEY not configured",
            "summary": None
        }
    
    if not opengraph_items or len(opengraph_items) == 0:
        return {
            "success": False,
            "error": "No OpenGraph data provided",
            "summary": None
        }
    
    try:
        # 使用 prompts 模块构建消息
        messages = build_messages(opengraph_items)
        
        # 根据文档，使用 Generation.call 进行文本生成
        # result_format="message" 确保返回标准格式
        response = dashscope.Generation.call(
            api_key=dashscope.api_key,  # 显式传入 API key
            model="qwen-turbo",  # 使用通义千问 Turbo 模型
            messages=messages,
            result_format="message",  # 使用标准消息格式
            max_tokens=200,  # 限制输出长度
            temperature=0.7,
        )
        
        # 调试：打印响应状态
        print(f"[AI Insight] Response status_code: {response.status_code}")
        
        # 根据文档，成功响应格式：response.output.choices[0].message.content
        if response.status_code == 200:
            try:
                # 标准响应格式：response.output.choices[0].message.content
                if hasattr(response, 'output') and response.output:
                    if hasattr(response.output, 'choices') and response.output.choices and len(response.output.choices) > 0:
                        choice = response.output.choices[0]
                        if hasattr(choice, 'message') and choice.message:
                            if hasattr(choice.message, 'content'):
                                summary = choice.message.content
                                if summary and isinstance(summary, str):
                                    summary = summary.strip()
                                    if summary:
                                        print(f"[AI Insight] Successfully got summary: {len(summary)} characters")
                                        return {
                                            "success": True,
                                            "summary": summary,
                                            "error": None
                                        }
            except Exception as e:
                print(f"[AI Insight] Error accessing response content: {e}")
                print(f"[AI Insight] Response type: {type(response)}")
                if hasattr(response, '__dict__'):
                    print(f"[AI Insight] Response attributes: {list(response.__dict__.keys())}")
            
            # 如果标准格式失败，尝试其他方式（调试用）
            print(f"[AI Insight] Standard format failed, trying alternatives...")
            print(f"[AI Insight] Response: {response}")
            if hasattr(response, '__dict__'):
                print(f"[AI Insight] Response __dict__: {response.__dict__}")
            
            return {
                "success": False,
                "error": "API response format is unexpected. Check server logs for details.",
                "summary": None
            }
        else:
            # 处理错误响应
            error_code = getattr(response, 'code', '')
            error_msg = getattr(response, 'message', 'Unknown API error')
            print(f"[AI Insight] API error: status={response.status_code}, code={error_code}, message={error_msg}")
            return {
                "success": False,
                "error": f"API error (status {response.status_code}): {error_msg}",
                "summary": None
            }
    
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "summary": None
        }


def analyze_single_opengraph(opengraph_item: Dict) -> Dict:
    """
    分析单个 OpenGraph 数据
    """
    return analyze_opengraph_data([opengraph_item])

