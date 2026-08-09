class BFRSError(Exception):
    """Base error with a user-actionable message."""


class ConfigurationError(BFRSError):
    pass


class DataDownloadError(BFRSError):
    pass
