// Tipos de la API de digo-landing-backend.

export type Site = 'HOGAR' | 'EMPRESAS'
export type Role = 'ADMIN' | 'AGENTE'

export type AuthUser = {
  id: string
  email: string
  name: string
  role: Role
  /** Espacios del panel a los que tiene acceso. */
  sites: Site[]
}

export type User = AuthUser & { active: boolean; createdAt: string }

export type Paginated<T> = { items: T[]; total: number; page: number; pageSize: number }

// ─── Libro de Reclamaciones ───
export type ComplaintKind = 'RECLAMO' | 'QUEJA'
export type ComplaintStatus = 'PENDIENTE' | 'EN_PROCESO' | 'RESPONDIDO'
export type DocumentType = 'DNI' | 'CE' | 'PASAPORTE' | 'RUC'
export type ContractedItem = 'PRODUCTO' | 'SERVICIO'

export type Complaint = {
  id: string
  code: string
  site: Site
  kind: ComplaintKind
  documentType: DocumentType
  documentNumber: string
  fullName: string
  address: string
  email: string
  phone: string
  isMinor: boolean
  guardianName: string | null
  guardianDocument: string | null
  itemType: ContractedItem
  amount: string | null
  itemDescription: string
  detail: string
  request: string
  status: ComplaintStatus
  /** YYYY-MM-DD */
  dueDate: string
  /** Días hábiles restantes; negativo = vencido; null = respondido. */
  businessDaysLeft: number | null
  response: string | null
  respondedAt: string | null
  respondedBy?: { id: string; name: string; email: string } | null
  assignedTo: { id: string; name: string } | null
  internalNotes: string | null
  /** Solo en el detalle: nombre con el que sale el correo de respuesta. */
  providerName?: string
  receiptSentAt: string | null
  responseSentAt: string | null
  createdAt: string
}

/** Listado de hojas: la página pedida y cuántas hay en cada estado con los demás filtros. */
export type ComplaintList = Paginated<Complaint> & { counts: Record<ComplaintStatus, number> }

export type ComplaintSummary = { pending: number; overdue: number; dueSoon: number }

// ─── Consultas ───
export type InquiryStatus = 'NUEVA' | 'EN_PROCESO' | 'ATENDIDA'

export type Inquiry = {
  id: string
  site: Site
  name: string
  phone: string
  email: string | null
  company: string | null
  ruc: string | null
  message: string
  status: InquiryStatus
  notes: string | null
  assignedTo: { id: string; name: string } | null
  /** Cuándo y quién la marcó como atendida (null si no lo está). */
  attendedAt: string | null
  attendedBy: { id: string; name: string } | null
  createdAt: string
  updatedAt: string
}

/** Listado de consultas: la página pedida y cuántas hay en cada estado con los demás filtros. */
export type InquiryList = Paginated<Inquiry> & { counts: Record<InquiryStatus, number> }

export type InquirySummaryRow = { site: Site; status: InquiryStatus; count: number }

// ─── Contenido ───
export type MediaAsset = {
  id: string
  url: string
  width: number
  height: number
  alt: string
  provider: 'CLOUDINARY' | 'LOCAL'
}

export type UploadConfig =
  | { mode: 'cloudinary'; cloudName: string; maxBytes: number }
  | { mode: 'local'; maxBytes: number }

export type CompanyProfile = {
  site: Site
  name: string
  shortName: string
  tagline: string
  legalName: string
  ruc: string
  address: string
  email: string
  phone: string
  phoneDisplay: string
  mobile: string | null
  mobileDisplay: string | null
  whatsapp: string
  whatsappDisplay: string
  advisorName: string | null
  website: string
  logoId: string | null
  logo: MediaAsset | null
  updatedAt: string
}

export type Plan = {
  id: string
  name: string
  downloadMbps: number
  uploadMbps: number
  /** Decimal serializado como texto. */
  price: string
  promoPrice: string | null
  promoMonths: number | null
  badge: string | null
  tvPackage: string | null
  features: string[]
  highlighted: boolean
  active: boolean
  position: number
}

export type SlideCtaKind = 'WHATSAPP' | 'LINK' | 'NONE'

export type CarouselSlide = {
  id: string
  title: string
  subtitle: string | null
  imageId: string
  image: MediaAsset
  ctaKind: SlideCtaKind
  ctaLabel: string | null
  ctaValue: string | null
  startsAt: string | null
  endsAt: string | null
  active: boolean
  position: number
}

export type SocialNetwork = 'FACEBOOK' | 'INSTAGRAM' | 'TIKTOK' | 'YOUTUBE' | 'LINKEDIN' | 'X' | 'OTRA'

export type SocialLink = {
  id: string
  network: SocialNetwork
  label: string
  url: string
  iconId: string | null
  icon: MediaAsset | null
  active: boolean
  position: number
}

export type AboutCategory = 'EQUIPO' | 'PROYECTOS' | 'OFICINAS' | 'ACTIVIDADES'

export type AboutPhoto = {
  id: string
  imageId: string
  image: MediaAsset
  category: AboutCategory
  caption: string | null
  active: boolean
  position: number
}

/** Un cambio sin publicar: uno por elemento (o por orden de una lista), con su efecto neto. */
export type ContentChange = {
  /** Identifica el cambio para deshacerlo (`plan:<id>`, `carouselSlide:all`…). */
  key: string
  entity: string
  label: string
  action: 'CREADO' | 'EDITADO' | 'ELIMINADO' | 'REORDENADO'
  at: string
  /** Se puede deshacer solo este cambio. */
  undoable: boolean
}

export type Assignable = { id: string; name: string }

export type PublishStatus = {
  site: Site
  changes: ContentChange[]
  contentUpdatedAt: string | null
  publishedAt: string | null
  publishedBy: { id: string; name: string } | null
  pendingChanges: boolean
  /** Se puede volver a lo publicado (hay foto de la última publicación). */
  canDiscard: boolean
  simulated: boolean
}

/** Punto [lat, lng] del contorno de una zona. */
export type LatLng = [number, number]

export type CoverageZone = {
  id: string
  name: string
  detail: string | null
  color: string
  /** Contorno: un anillo por parte de la zona. */
  rings: LatLng[][]
  /** Relación de OpenStreetMap de donde salió el contorno, p. ej. "relation/1887817". */
  osmRef: string | null
  active: boolean
  position: number
}

/** Distrito encontrado en OpenStreetMap (buscador de la zona). */
export type BoundaryResult = {
  osmRef: string
  name: string
  place: string
  kind: string
  rings: LatLng[][]
  points: number
}
