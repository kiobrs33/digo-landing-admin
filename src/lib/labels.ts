import type { ComplaintStatus, DocumentType, InquiryStatus, Role, Site } from '@/api/types'

export const siteLabel: Record<Site, string> = { HOGAR: 'Hogar', EMPRESAS: 'Empresas' }
export const roleLabel: Record<Role, string> = { ADMIN: 'Administrador', AGENTE: 'Agente' }

export const complaintStatusLabel: Record<ComplaintStatus, string> = {
  PENDIENTE: 'Pendiente',
  EN_PROCESO: 'En proceso',
  RESPONDIDO: 'Respondido',
}

export const inquiryStatusLabel: Record<InquiryStatus, string> = {
  NUEVA: 'Nueva',
  EN_PROCESO: 'En proceso',
  ATENDIDA: 'Atendida',
}

export const documentLabel: Record<DocumentType, string> = {
  DNI: 'DNI',
  CE: 'Carné de extranjería',
  PASAPORTE: 'Pasaporte',
  RUC: 'RUC',
}

export const socialNetworkLabel: Record<import('@/api/types').SocialNetwork, string> = {
  FACEBOOK: 'Facebook',
  INSTAGRAM: 'Instagram',
  TIKTOK: 'TikTok',
  YOUTUBE: 'YouTube',
  LINKEDIN: 'LinkedIn',
  X: 'X (Twitter)',
  OTRA: 'Otra',
}

export const aboutCategoryLabel: Record<import('@/api/types').AboutCategory, string> = {
  EQUIPO: 'Equipo',
  PROYECTOS: 'Proyectos',
  OFICINAS: 'Oficinas',
  ACTIVIDADES: 'Actividades',
}

export const formatPrice = (value: string | number) => `S/ ${Number(value).toFixed(2)}`
