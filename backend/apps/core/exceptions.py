"""
Format commun des erreurs de l'API.

DRF renvoie déjà les messages ({"champ": ["message"]} ou {"detail": "message"}).
On ajoute "codes", la même structure avec des codes stables (ex. "invalid_credentials",
"phone_taken") : le frontend s'en sert pour choisir la traduction à afficher,
sans dépendre du texte français du message.
"""
from rest_framework.exceptions import APIException
from rest_framework.views import exception_handler


def api_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None or not isinstance(exc, APIException):
        return response

    codes = exc.get_codes()
    if isinstance(response.data, dict) and not isinstance(codes, dict):
        codes = {"detail": codes}  # ex. {"detail": "invalid_credentials"}
    if isinstance(response.data, dict):
        response.data["codes"] = codes
    else:
        # Erreurs de validation globales renvoyées sous forme de liste
        response.data = {"non_field_errors": response.data, "codes": {"non_field_errors": codes}}
    return response
