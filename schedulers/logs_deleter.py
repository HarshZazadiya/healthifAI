import logging
from pathlib import Path

def cleanup_logs():
    """Close file handlers and clear log files"""
    
    try:
        from logs.logging import logger
        for handler in logger.handlers[:]:
            if isinstance(handler, logging.FileHandler):
                handler.flush()
                handler.close()
                logger.removeHandler(handler)
                print(f"Closed file handler for: {handler.baseFilename}")
    except Exception as e:
        print(f"Error closing HealthifAI logger: {e}")
    
    root_logger = logging.getLogger()
    for handler in root_logger.handlers[:]:
        if isinstance(handler, logging.FileHandler):
            handler.flush()
            handler.close()
            root_logger.removeHandler(handler)
    import gc
    gc.collect()
    
    log_dir = Path("logs")
    if log_dir.exists():
        for item in log_dir.iterdir():
            if item.suffix == '.py':
                continue
            
            try:
                if item.is_file():
                    item.unlink()
                    print(f"Deleted: {item}")
                elif item.is_dir() and item.name != '__pycache__':
                    import shutil
                    shutil.rmtree(item)
                    print(f"Deleted directory: {item}")
            except PermissionError as e:
                print(f"Permission error: {item} is still in use")
            except Exception as e:
                print(f"Error deleting {item}: {e}")
        print("✅ Logs cleaned up successfully")