import { Request, Response, NextFunction } from "express";

import Joi from "joi";
import bcrypt from "bcrypt";
import UsersModel from "../models/UsersModel";

class Validate {
  static ValidateRegister = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      let Schema = Joi.object({
        name: Joi.string()
          .min(3)
          .max(20)
          .required()
          .pattern(/^[A-Za-z0-9]+$/)
          .message("Никнейм содержит запрещённые символы."),
        email: Joi.string()
          .min(5)
          .max(50)
          .required()
          .email()
          .pattern(/^[A-Za-z@0-9.]+$/)
          .message("Адрес электронной почты содержит запрещённые символы.")
          .email(),
        password: Joi.string().min(6).max(50).required(),
        confirmPassword: Joi.string().valid(Joi.ref("password")).required(),
      }).messages({
        "any.required": "Пожалуйста, заполните все поля ввода.",
        "string.empty": "Пожалуйста, укажите ваше имя.",
        "string.email":
          "Пожалуйста, введите корректный адрес электронной почты.",
        "any.only": "Пароли не совпадают.",
        "string.min": "Пароль должен содержать как минимум 6 символов.",
        "string.pattern.base": "Поле содержит запрещенные символы.",
      });

      let { error } = Schema.validate(req.body);
      console.log("validation error", error);
      if (error) {
        // return res.status(400).json({ error: error.message });
        return res.status(400).json({ error: error.details[0].message });
      }

      const { email, name } = req.body;
      const normalizedEmail = email.toLowerCase();
      const normalizedName = name.toLowerCase();

      const [existingUser, existingUsername] = await Promise.all([
        UsersModel.findOne({ email: normalizedEmail }),
        UsersModel.findOne({ requestName: normalizedName }),
      ]);

      if (existingUser) {
        const errorMsg = "Этот адрес электронной почты уже зарегистрирован.";
        return res.status(400).json({ error: errorMsg });
      }

      if (existingUsername) {
        const errorMsg = "Никнейм уже занят.";
        return res.status(400).json({ error: errorMsg });
      }

      next();
    } catch (error: any) {
      console.log("validate error:", error);
      return res.status(500).json({ error: error.message });
    }
  };

  static ValidateLogin = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const Schema = Joi.object({
        email: Joi.string()
          .min(5)
          .max(50)
          .required()
          .pattern(/^[A-Za-z@0-9.]+$/)
          .message("Адрес электронной почты содержит запрещённые символы.")
          .email(),
        password: Joi.string().min(6).max(50).required(),
      }).messages({
        "any.required": "Пожалуйста, заполните все поля ввода.",
      });
      const { error } = Schema.validate(req.body);
      if (error) {
        return res.status(400).json({ error: error.message });
      }

      const { email, password } = req.body;

      const existingUser = (await UsersModel.findOne({ email })) as any;

      if (!existingUser) {
        const errorMsg = "Адрес электронной почты не найден.";
        return res.status(400).json({ error: errorMsg });
      }

      const passwordMatch = await bcrypt.compare(
        password,
        existingUser.password,
      );
      if (!passwordMatch) {
        const errorMsg = "Неверный адрес или пароль.";
        return res.status(401).json({ error: errorMsg });
      }

      next();
    } catch (error: any) {
      console.error("validate error:", error);
      return res.status(500).json({ error: error.message });
    }
  };

}

export default Validate;
