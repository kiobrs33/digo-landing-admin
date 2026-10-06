import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, MessageCircle, Phone, Smartphone } from 'lucide-react'
import { type FormEvent, type ReactNode, useState } from 'react'
import { api } from '@/api/client'
import type { CompanyProfile, MediaAsset } from '@/api/types'
import { ImageField } from '@/components/ImageField'
import { saveAltIfChanged } from '@/lib/upload'
import { Button, Card, DetailSkeleton, ErrorNotice, Field, Input } from '@/components/ui'
import { cx } from '@/lib/cx'
import { type ParsedPhone, parseLandline, parseMobile, whatsappOf } from '@/lib/phone'
import { useToast } from '@/lib/toast-context'
import { publishKey, useContentSite } from './site'

type Form = Omit<CompanyProfile, 'site' | 'logo' | 'updatedAt' | 'logoId' | 'mobile' | 'mobileDisplay' | 'advisorName'> & {
  mobile: string
  mobileDisplay: string
  advisorName: string
}

export function CompanyPage() {
  const { site } = useContentSite()
  const company = useQuery({
    queryKey: ['content', site, 'company'],
    queryFn: () => api<CompanyProfile>(`/admin/sites/${site.toLowerCase()}/company`),
  })

  if (company.isPending) return <DetailSkeleton />
  if (company.error) return <ErrorNotice error={company.error} />
  // `key`: al cambiar de sitio, el formulario arranca con los datos de ese sitio.
  return <CompanyForm key={site} profile={company.data} />
}

function CompanyForm({ profile }: { profile: CompanyProfile }) {
  const { site } = useContentSite()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [form, setForm] = useState<Form>({
    name: profile.name,
    shortName: profile.shortName,
    tagline: profile.tagline,
    legalName: profile.legalName,
    ruc: profile.ruc,
    address: profile.address,
    email: profile.email,
    phone: profile.phone,
    phoneDisplay: profile.phoneDisplay,
    mobile: profile.mobile ?? '',
    mobileDisplay: profile.mobileDisplay ?? '',
    whatsapp: profile.whatsapp,
    whatsappDisplay: profile.whatsappDisplay,
    advisorName: profile.advisorName ?? '',
    website: profile.website,
  })
  // Los dos números oficiales se escriben una vez; de ahí salen el formato técnico y el visible.
  const [landline, setLandline] = useState(profile.phoneDisplay || profile.phone)
  const [mobile, setMobile] = useState(profile.mobileDisplay || profile.mobile || '')
  const [checked, setChecked] = useState(false)
  const landlineParsed = parseLandline(landline)
  const mobileParsed = parseMobile(mobile)
  const [logo, setLogo] = useState<MediaAsset | null>(profile.logo)
  const [logoAlt, setLogoAlt] = useState(profile.logo?.alt ?? `Logo de ${profile.name}`)
  const set = (key: keyof Form) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [key]: event.target.value }))

  const save = useMutation({
    mutationFn: async () => {
      await saveAltIfChanged(logo, logoAlt)
      return api<CompanyProfile>(`/admin/sites/${site.toLowerCase()}/company`, {
        method: 'PUT',
        body: {
          ...form,
          phone: landlineParsed?.e164,
          phoneDisplay: landlineParsed?.display,
          mobile: mobileParsed?.e164,
          mobileDisplay: mobileParsed?.display,
          // Los dos números tienen WhatsApp; el fijo es el principal de los botones de una sola
          // acción (p. ej. "Lo quiero" de cada plan). Quien escribe es siempre Digo Telecom.
          whatsapp: landlineParsed && whatsappOf(landlineParsed),
          whatsappDisplay: landlineParsed?.display,
          advisorName: null,
          logoId: logo?.id ?? null,
        },
      })
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['content', site, 'company'], data)
      void queryClient.invalidateQueries({ queryKey: publishKey })
      toast({ message: 'Datos guardados. Publica para verlos en la web.' })
    },
  })

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    setChecked(true)
    if (!landlineParsed || !mobileParsed) return
    save.mutate()
  }

  const text = (key: keyof Form, label: string, props: { hint?: string; required?: boolean; type?: string; placeholder?: string; inputMode?: 'tel' | 'email' | 'numeric' } = {}) => (
    <Field label={label} hint={props.hint}>
      {(id) => (
        <Input
          id={id}
          type={props.type ?? 'text'}
          inputMode={props.inputMode}
          required={props.required ?? true}
          placeholder={props.placeholder}
          value={form[key]}
          onChange={set(key)}
        />
      )}
    </Field>
  )

  return (
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="flex flex-col gap-6">
        <Card>
          <h2 className="mb-4 font-bold text-navy">Marca</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {text('name', 'Nombre comercial', { placeholder: 'Digo Telecom' })}
            {text('shortName', 'Nombre corto', { placeholder: 'Digo', hint: 'El que aparece en el encabezado.' })}
            <div className="sm:col-span-2">{text('tagline', 'Eslogan', { placeholder: '¡Siempre contigo!' })}</div>
            {text('website', 'Sitio web', { placeholder: 'digo.net.pe', hint: 'Sin https://' })}
          </div>
        </Card>

        <Card>
          <h2 className="mb-1 font-bold text-navy">Datos legales</h2>
          <p className="mb-4 text-sm text-muted">Aparecen en el Libro de Reclamaciones y en las constancias.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {text('legalName', 'Razón social', { placeholder: 'DIGO TELECOM S.A.C.' })}
            {text('ruc', 'RUC', { inputMode: 'numeric', placeholder: '11 dígitos, p. ej. 20610702369' })}
            <div className="sm:col-span-2">{text('address', 'Dirección', { placeholder: 'Calle, número, urbanización y ciudad' })}</div>
          </div>
        </Card>

        <Card>
          <h2 className="mb-1 font-bold text-navy">Contacto</h2>
          <p className="mb-4 text-sm text-muted">
            Los dos números oficiales: los dos reciben llamadas y WhatsApp y se muestran en la web. Escríbelos como
            quieras; el formato se arma solo.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              {text('email', 'Correo', { type: 'email', inputMode: 'email', placeholder: 'team@digo.net.pe' })}
            </div>

            <PhoneField
              label="Teléfono fijo"
              icon={<Phone className="size-4" aria-hidden />}
              value={landline}
              onChange={setLandline}
              parsed={landlineParsed}
              placeholder="(01) 701-2341"
              help="Lima: 01 + 7 dígitos. Provincias: código + 6 dígitos (Arequipa 054)."
              invalid="Revisa el fijo: 01 + 7 dígitos (Lima) o código de 3 cifras + 6 dígitos."
              showError={checked}
            />
            <PhoneField
              label="Celular (9 dígitos)"
              icon={<Smartphone className="size-4" aria-hidden />}
              value={mobile}
              onChange={setMobile}
              parsed={mobileParsed}
              placeholder="925 521 741"
              help="9 dígitos que empiezan por 9."
              invalid="El celular debe tener 9 dígitos y empezar por 9."
              showError={checked}
            />

            {/* Así se verá: y enlaces para comprobar que los botones de la web funcionan. */}
            <div className="rounded-lg bg-surface p-4 text-sm sm:col-span-2">
              <p className="mb-2 text-xs font-semibold text-muted">Así se verá en la web</p>
              <ul className="grid gap-2">
                <PreviewRow icon={<Phone className="size-4" aria-hidden />} label="Teléfono fijo" phone={landlineParsed} />
                <PreviewRow icon={<Smartphone className="size-4" aria-hidden />} label="Celular" phone={mobileParsed} />
              </ul>
            </div>
          </div>
        </Card>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" loading={save.isPending}>
            Guardar datos
          </Button>
        </div>
        <ErrorNotice error={save.error} />
      </div>

      <Card className="h-fit">
        <ImageField
          label="Logo"
          hint="PNG con fondo transparente o blanco, cuadrado."
          site={site}
          value={logo}
          onChange={setLogo}
          alt={logoAlt}
          onAltChange={setLogoAlt}
        />
      </Card>
    </form>
  )
}

/** Un número oficial: se escribe como sea y debajo se ve cómo quedará (o qué falta). */
function PhoneField({
  label,
  icon,
  value,
  onChange,
  parsed,
  placeholder,
  help,
  invalid,
  showError,
}: {
  label: string
  icon: ReactNode
  value: string
  onChange: (value: string) => void
  parsed: ParsedPhone | null
  placeholder: string
  help: string
  invalid: string
  showError: boolean
}) {
  const [touched, setTouched] = useState(false)
  const error = !parsed && (touched || showError) ? invalid : undefined
  return (
    <Field label={label} error={error} hint={parsed ? `Se verá: ${parsed.display} · enlace ${parsed.e164}` : help}>
      {(id) => (
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted">{icon}</span>
          <Input
            id={id}
            type="tel"
            inputMode="tel"
            autoComplete="off"
            required
            placeholder={placeholder}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onBlur={() => setTouched(true)}
            className={cx('pl-9 tabular-nums', parsed && 'pr-9')}
          />
          {parsed && <Check className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-emerald-600" aria-hidden />}
        </div>
      )}
    </Field>
  )
}

function PreviewRow({ icon, label, phone }: { icon: ReactNode; label: string; phone: ParsedPhone | null }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="text-muted">{icon}</span>
      <span className="text-muted">{label}</span>
      <strong className="font-semibold tabular-nums">{phone?.display ?? '—'}</strong>
      {phone && (
        <span className="ml-auto flex gap-3 text-xs font-semibold">
          <a href={`tel:${phone.e164}`} className="text-navy hover:underline">
            Probar llamada
          </a>
          <a
            href={`https://wa.me/${whatsappOf(phone)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-emerald-700 hover:underline"
          >
            <MessageCircle className="size-3.5" aria-hidden />
            Probar WhatsApp
          </a>
        </span>
      )}
    </li>
  )
}
