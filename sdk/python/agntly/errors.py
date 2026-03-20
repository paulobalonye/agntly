class AgntlyError(Exception):
    """Base exception for Agntly SDK errors."""

    def __init__(self, message: str, status: int = 0, body: object = None):
        super().__init__(message)
        self.status = status
        self.body = body
