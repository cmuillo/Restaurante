import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  BadRequestException,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';

/** Traducciones de mensajes de validación de class-validator */
const VALIDATION_MESSAGE_MAP: Record<string, string> = {
  // Date validation
  'each value in birthdate must be a valid ISO 8601 date string':
    'La fecha de nacimiento debe tener formato válido (YYYY-MM-DD)',
  'birthdate must be a valid ISO 8601 date string':
    'La fecha de nacimiento debe tener formato válido (YYYY-MM-DD)',

  // Email validation
  'email must be an email': 'El email debe ser válido',
  'email must be a string': 'El email debe ser texto',

  // String validation
  'must be a string': 'El campo debe ser texto',
  'must be a boolean': 'El campo debe ser verdadero o falso',
  'must be a number': 'El campo debe ser un número',

  // Max length
  'must be shorter than or equal to': 'El campo no puede exceder los caracteres permitidos',

  // Required/Not empty
  'should not be empty': 'El campo no puede estar vacío',
  'must be defined': 'El campo es obligatorio',

  // Hacienda validation
  'haciendataxid debe ser alfanumérico válido (hacienda 4.4)':
    'La cédula/RUC debe ser alfanumérica válida (Hacienda 4.4)',

  // Email unique
  'Ya existe un cliente con ese email': 'Ya existe un cliente con ese email',
  'El email ya está registrado': 'El email ya está registrado',
  'Ya existe una cuenta con ese email': 'Ya existe una cuenta con ese email',
};

/**
 * Traduce automáticamente mensajes de error de validación
 * de class-validator al español
 */
@Catch(BadRequestException, HttpException)
export class ValidationExceptionFilter implements ExceptionFilter {
  catch(exception: BadRequestException | HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    let translatedResponse = exceptionResponse;

    // Procesar errores de validación de class-validator
    if (status === 400 && typeof exceptionResponse === 'object') {
      const body = exceptionResponse as any;
      if (body.message && Array.isArray(body.message)) {
        // Traduce cada mensaje de error
        const translatedMessages = body.message.map((msg: string) => {
          // Buscar en el mapa de traducciones
          for (const [key, value] of Object.entries(VALIDATION_MESSAGE_MAP)) {
            if (msg.toLowerCase().includes(key.toLowerCase())) {
              return value;
            }
          }
          // Si no encuentra traducción, retorna el mensaje original
          return msg;
        });

        translatedResponse = {
          statusCode: status,
          message: translatedMessages,
          error: body.error || 'Error de validación',
        };
      }
    }

    response.status(status).json(translatedResponse);
  }
}
