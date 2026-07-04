import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type Lang = 'ca' | 'es' | 'en'

export const LANGS: { code: Lang; label: string }[] = [
  { code: 'ca', label: 'Català' },
  { code: 'es', label: 'Español' },
  { code: 'en', label: 'English' },
]

const LOCALES: Record<Lang, string> = { ca: 'ca-ES', es: 'es-ES', en: 'en-GB' }
const STORAGE_KEY = 'for-gear:lang'
const DEFAULT_LANG: Lang = 'ca'

const ca = {
  'nav.main': 'Navegació principal',
  'tabs.gear': 'Material',
  'tabs.kits': 'Kits',
  'tabs.packs': 'Motxilles',
  'tabs.data': 'Dades',

  'common.item': 'element',
  'common.items': 'elements',
  'common.edit': 'Edita',
  'common.delete': 'Suprimeix',
  'common.save': 'Desa',
  'common.cancel': 'Cancel·la',
  'common.done': 'Fet',

  'gear.add': 'Afegeix',
  'gear.searchPlaceholder': 'Cerca per nom, etiqueta o nota…',
  'gear.searchLabel': 'Cerca material',
  'gear.filterByCategory': 'Filtra per categoria',
  'gear.all': 'Tot',
  'gear.emptyFiltered': 'No s’ha trobat cap element.',
  'gear.addFirst': 'Afegeix el primer element',

  'item.missing': 'Aquest element ja no existeix.',
  'item.backToGear': 'Torna al material',
  'item.photo': 'Fotografia',
  'item.addPhoto': 'Afegeix una fotografia',
  'item.changePhoto': 'Canvia la fotografia',
  'item.deletePhoto': 'Suprimeix la fotografia',
  'item.photoError': 'No s’ha pogut desar la fotografia.',
  'item.photoLocalHint': 'La fotografia es desa només en aquest dispositiu.',
  'item.category': 'Categoria',
  'item.weight': 'Pes',
  'item.caseWeight': 'Pes de la funda',
  'item.placement': 'Ubicació',
  'item.maxLoad': 'Càrrega màxima',
  'item.specs': 'Característiques',
  'item.tags': 'Etiquetes',
  'item.notes': 'Notes',
  'item.inPacks': 'Es troba a',
  'item.confirmDelete': 'Voleu suprimir «{name}»? També es traurà de totes les motxilles i kits.',

  'form.newTitle': 'Element nou',
  'form.editTitle': 'Edita l’element',
  'form.name': 'Nom',
  'form.namePlaceholder': 'quilt, tarp, fogó…',
  'form.weight': 'Pes (g)',
  'form.caseWeight': 'Pes de la funda (g)',
  'form.caseWeightHint': '(si es pesa a part)',
  'form.placementHint': '(on va dins la motxilla)',
  'form.placementPlaceholder': 'fons, butxaca exterior…',
  'form.maxLoad': 'Càrrega màxima (kg)',
  'form.maxLoadHint': '(recomanada pel fabricant)',
  'form.specAdd': 'Afegeix una característica',
  'form.specLabelPlaceholder': 'Capacitat, R-value…',
  'form.specValuePlaceholder': '750 ml, −1 °C…',
  'form.specRemove': 'Treu la característica',
  'form.tagsHint': '(separades per comes)',
  'form.tagsPlaceholder': 'ultralight, hivern',

  'kits.new': 'Crea un kit',
  'kits.name': 'Nom del kit',
  'kits.namePlaceholder': 'kit arròs, kit cafè…',
  'kits.empty': 'Encara no hi ha cap kit.',
  'kit.delete': 'Suprimeix el kit',
  'kit.confirmDelete': 'Voleu suprimir el kit «{name}»? El material no es perd.',
  'kit.empty': 'El kit és buit.',

  'packs.new': 'Prepara’n una',
  'packs.tripName': 'Nom de la sortida',
  'packs.tripNamePlaceholder': 'Vivac d’estiu, ruta de 3 dies…',
  'packs.backpack': 'Motxilla',
  'packs.create': 'Crea',
  'packs.needBackpack':
    'Per preparar una motxilla, primer afegiu-ne una al material amb la categoria «{category}».',
  'packs.addBackpack': 'Afegeix una motxilla',
  'packs.empty': 'Encara no hi ha cap motxilla preparada.',
  'packs.unknownBackpack': 'Motxilla desconeguda',

  'pack.missing': 'Aquesta motxilla ja no existeix.',
  'pack.backToPacks': 'Torna a les motxilles',
  'pack.inside': 'Dins de',
  'pack.totalHint': 'Pes total, amb la motxilla inclosa',
  'pack.contents': 'Contingut',
  'pack.addItems': 'Afegeix elements',
  'pack.searchPlaceholder': 'Cerca material…',
  'pack.noCandidates': 'No hi ha cap més element disponible.',
  'pack.empty': 'La motxilla és buida.',
  'pack.removeItem': 'Treu «{name}» de la motxilla',
  'pack.load': 'Càrrega: {load} de {max} · {pct} %',
  'pack.overBy': '{amount} de més',
  'pack.delete': 'Suprimeix la motxilla',
  'pack.confirmDelete': 'Voleu suprimir la motxilla «{name}»? El material no es perd.',

  'weightbar.total': 'Pes total: {weight}',

  'settings.title': 'Ajustos',
  'settings.language': 'Llengua',
  'settings.version': 'Versió',

  'data.items': 'Elements',
  'data.kits': 'Kits',
  'data.packs': 'Motxilles preparades',
  'data.totalWeight': 'Pes de tot el material',
  'data.storageHint':
    'Les dades es desen en aquest dispositiu, dins del navegador. Exporteu-les de tant en tant per tenir-ne una còpia, o per posar-les al repositori com a llavor.',
  'data.export': 'Exporta el JSON',
  'data.import': 'Importa un JSON',
  'data.reset': 'Restaura les dades d’exemple',
  'data.importInvalid':
    'El fitxer no té el format esperat (calen «categories», «items» i «groups»).',
  'data.importConfirm':
    'Voleu substituir les dades actuals per les del fitxer? ({items} elements, {groups} grups)',
  'data.importError': 'No s’ha pogut llegir el fitxer JSON.',
  'data.resetConfirm':
    'Voleu descartar totes les dades i tornar a les dades d’exemple? Aquesta acció no es pot desfer.',
} as const

export type TKey = keyof typeof ca

const es: Record<TKey, string> = {
  'nav.main': 'Navegación principal',
  'tabs.gear': 'Material',
  'tabs.kits': 'Kits',
  'tabs.packs': 'Mochilas',
  'tabs.data': 'Datos',

  'common.item': 'elemento',
  'common.items': 'elementos',
  'common.edit': 'Editar',
  'common.delete': 'Eliminar',
  'common.save': 'Guardar',
  'common.cancel': 'Cancelar',
  'common.done': 'Hecho',

  'gear.add': 'Añadir',
  'gear.searchPlaceholder': 'Busca por nombre, etiqueta o nota…',
  'gear.searchLabel': 'Buscar material',
  'gear.filterByCategory': 'Filtrar por categoría',
  'gear.all': 'Todo',
  'gear.emptyFiltered': 'No se ha encontrado ningún elemento.',
  'gear.addFirst': 'Añade el primer elemento',

  'item.missing': 'Este elemento ya no existe.',
  'item.backToGear': 'Volver al material',
  'item.photo': 'Fotografía',
  'item.addPhoto': 'Añadir una fotografía',
  'item.changePhoto': 'Cambiar la fotografía',
  'item.deletePhoto': 'Eliminar la fotografía',
  'item.photoError': 'No se ha podido guardar la fotografía.',
  'item.photoLocalHint': 'La fotografía se guarda solo en este dispositivo.',
  'item.category': 'Categoría',
  'item.weight': 'Peso',
  'item.caseWeight': 'Peso de la funda',
  'item.placement': 'Ubicación',
  'item.maxLoad': 'Carga máxima',
  'item.specs': 'Características',
  'item.tags': 'Etiquetas',
  'item.notes': 'Notas',
  'item.inPacks': 'Se encuentra en',
  'item.confirmDelete':
    '¿Quieres eliminar «{name}»? También se quitará de todas las mochilas y kits.',

  'form.newTitle': 'Elemento nuevo',
  'form.editTitle': 'Editar el elemento',
  'form.name': 'Nombre',
  'form.namePlaceholder': 'quilt, tarp, hornillo…',
  'form.weight': 'Peso (g)',
  'form.caseWeight': 'Peso de la funda (g)',
  'form.caseWeightHint': '(si se pesa aparte)',
  'form.placementHint': '(dónde va dentro de la mochila)',
  'form.placementPlaceholder': 'fondo, bolsillo exterior…',
  'form.maxLoad': 'Carga máxima (kg)',
  'form.maxLoadHint': '(recomendada por el fabricante)',
  'form.specAdd': 'Añadir una característica',
  'form.specLabelPlaceholder': 'Capacidad, R-value…',
  'form.specValuePlaceholder': '750 ml, −1 °C…',
  'form.specRemove': 'Quitar la característica',
  'form.tagsHint': '(separadas por comas)',
  'form.tagsPlaceholder': 'ultralight, invierno',

  'kits.new': 'Crear un kit',
  'kits.name': 'Nombre del kit',
  'kits.namePlaceholder': 'kit arroz, kit café…',
  'kits.empty': 'Todavía no hay ningún kit.',
  'kit.delete': 'Eliminar el kit',
  'kit.confirmDelete': '¿Quieres eliminar el kit «{name}»? El material no se pierde.',
  'kit.empty': 'El kit está vacío.',

  'packs.new': 'Preparar una',
  'packs.tripName': 'Nombre de la salida',
  'packs.tripNamePlaceholder': 'Vivac de verano, ruta de 3 días…',
  'packs.backpack': 'Mochila',
  'packs.create': 'Crear',
  'packs.needBackpack':
    'Para preparar una mochila, primero añade una al material con la categoría «{category}».',
  'packs.addBackpack': 'Añade una mochila',
  'packs.empty': 'Todavía no hay ninguna mochila preparada.',
  'packs.unknownBackpack': 'Mochila desconocida',

  'pack.missing': 'Esta mochila ya no existe.',
  'pack.backToPacks': 'Volver a las mochilas',
  'pack.inside': 'Dentro de',
  'pack.totalHint': 'Peso total, con la mochila incluida',
  'pack.contents': 'Contenido',
  'pack.addItems': 'Añadir elementos',
  'pack.searchPlaceholder': 'Buscar material…',
  'pack.noCandidates': 'No hay ningún elemento más disponible.',
  'pack.empty': 'La mochila está vacía.',
  'pack.removeItem': 'Quitar «{name}» de la mochila',
  'pack.load': 'Carga: {load} de {max} · {pct} %',
  'pack.overBy': '{amount} de más',
  'pack.delete': 'Eliminar la mochila',
  'pack.confirmDelete': '¿Quieres eliminar la mochila «{name}»? El material no se pierde.',

  'weightbar.total': 'Peso total: {weight}',

  'settings.title': 'Ajustes',
  'settings.language': 'Idioma',
  'settings.version': 'Versión',

  'data.items': 'Elementos',
  'data.kits': 'Kits',
  'data.packs': 'Mochilas preparadas',
  'data.totalWeight': 'Peso de todo el material',
  'data.storageHint':
    'Los datos se guardan en este dispositivo, dentro del navegador. Expórtalos de vez en cuando para tener una copia, o para ponerlos en el repositorio como semilla.',
  'data.export': 'Exportar el JSON',
  'data.import': 'Importar un JSON',
  'data.reset': 'Restaurar los datos de ejemplo',
  'data.importInvalid':
    'El archivo no tiene el formato esperado (hacen falta «categories», «items» y «groups»).',
  'data.importConfirm':
    '¿Quieres sustituir los datos actuales por los del archivo? ({items} elementos, {groups} grupos)',
  'data.importError': 'No se ha podido leer el archivo JSON.',
  'data.resetConfirm':
    '¿Quieres descartar todos los datos y volver a los datos de ejemplo? Esta acción no se puede deshacer.',
}

const en: Record<TKey, string> = {
  'nav.main': 'Main navigation',
  'tabs.gear': 'Gear',
  'tabs.kits': 'Kits',
  'tabs.packs': 'Packs',
  'tabs.data': 'Data',

  'common.item': 'item',
  'common.items': 'items',
  'common.edit': 'Edit',
  'common.delete': 'Delete',
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.done': 'Done',

  'gear.add': 'Add',
  'gear.searchPlaceholder': 'Search by name, tag or note…',
  'gear.searchLabel': 'Search gear',
  'gear.filterByCategory': 'Filter by category',
  'gear.all': 'All',
  'gear.emptyFiltered': 'No items found.',
  'gear.addFirst': 'Add the first item',

  'item.missing': 'This item no longer exists.',
  'item.backToGear': 'Back to gear',
  'item.photo': 'Photo',
  'item.addPhoto': 'Add a photo',
  'item.changePhoto': 'Change photo',
  'item.deletePhoto': 'Delete photo',
  'item.photoError': 'Could not save the photo.',
  'item.photoLocalHint': 'The photo is stored on this device only.',
  'item.category': 'Category',
  'item.weight': 'Weight',
  'item.caseWeight': 'Case weight',
  'item.placement': 'Placement',
  'item.maxLoad': 'Max load',
  'item.specs': 'Specs',
  'item.tags': 'Tags',
  'item.notes': 'Notes',
  'item.inPacks': 'Found in',
  'item.confirmDelete': 'Delete “{name}”? It will also be removed from every pack and kit.',

  'form.newTitle': 'New item',
  'form.editTitle': 'Edit item',
  'form.name': 'Name',
  'form.namePlaceholder': 'quilt, tarp, stove…',
  'form.weight': 'Weight (g)',
  'form.caseWeight': 'Case weight (g)',
  'form.caseWeightHint': '(if weighed separately)',
  'form.placementHint': '(where it goes in the pack)',
  'form.placementPlaceholder': 'bottom, outer pocket…',
  'form.maxLoad': 'Max load (kg)',
  'form.maxLoadHint': '(manufacturer’s recommendation)',
  'form.specAdd': 'Add a spec',
  'form.specLabelPlaceholder': 'Capacity, R-value…',
  'form.specValuePlaceholder': '750 ml, −1 °C…',
  'form.specRemove': 'Remove spec',
  'form.tagsHint': '(comma-separated)',
  'form.tagsPlaceholder': 'ultralight, winter',

  'kits.new': 'Create a kit',
  'kits.name': 'Kit name',
  'kits.namePlaceholder': 'rice kit, coffee kit…',
  'kits.empty': 'No kits yet.',
  'kit.delete': 'Delete kit',
  'kit.confirmDelete': 'Delete the kit “{name}”? Your gear is not lost.',
  'kit.empty': 'The kit is empty.',

  'packs.new': 'Prepare one',
  'packs.tripName': 'Trip name',
  'packs.tripNamePlaceholder': 'Summer bivy, 3-day route…',
  'packs.backpack': 'Backpack',
  'packs.create': 'Create',
  'packs.needBackpack':
    'To prepare a pack, first add a backpack to your gear with the “{category}” category.',
  'packs.addBackpack': 'Add a backpack',
  'packs.empty': 'No packs prepared yet.',
  'packs.unknownBackpack': 'Unknown backpack',

  'pack.missing': 'This pack no longer exists.',
  'pack.backToPacks': 'Back to packs',
  'pack.inside': 'Inside',
  'pack.totalHint': 'Total weight, backpack included',
  'pack.contents': 'Contents',
  'pack.addItems': 'Add items',
  'pack.searchPlaceholder': 'Search gear…',
  'pack.noCandidates': 'No more items available.',
  'pack.empty': 'The pack is empty.',
  'pack.removeItem': 'Remove “{name}” from the pack',
  'pack.load': 'Load: {load} of {max} · {pct} %',
  'pack.overBy': '{amount} over',
  'pack.delete': 'Delete pack',
  'pack.confirmDelete': 'Delete the pack “{name}”? Your gear is not lost.',

  'weightbar.total': 'Total weight: {weight}',

  'settings.title': 'Settings',
  'settings.language': 'Language',
  'settings.version': 'Version',

  'data.items': 'Items',
  'data.kits': 'Kits',
  'data.packs': 'Prepared packs',
  'data.totalWeight': 'Weight of all gear',
  'data.storageHint':
    'Data is stored on this device, inside the browser. Export it from time to time to keep a copy, or to put it in the repository as the seed.',
  'data.export': 'Export JSON',
  'data.import': 'Import JSON',
  'data.reset': 'Restore sample data',
  'data.importInvalid':
    'The file does not have the expected format (it needs “categories”, “items” and “groups”).',
  'data.importConfirm':
    'Replace the current data with the file’s? ({items} items, {groups} groups)',
  'data.importError': 'Could not read the JSON file.',
  'data.resetConfirm':
    'Discard all data and go back to the sample data? This action cannot be undone.',
}

const dictionaries: Record<Lang, Record<TKey, string>> = { ca, es, en }

// Configuració regional activa, llegida per formatWeight() fora de React.
let activeLocale = LOCALES[DEFAULT_LANG]

export function getLocale(): string {
  return activeLocale
}

function loadLang(): Lang {
  const saved = localStorage.getItem(STORAGE_KEY)
  return saved === 'ca' || saved === 'es' || saved === 'en' ? saved : DEFAULT_LANG
}

type I18n = {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: TKey, vars?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18n | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(loadLang)

  // S'assigna durant el render perquè formatWeight() usi la llengua nova
  // en aquest mateix cicle (l'assignació és idempotent).
  activeLocale = LOCALES[lang]

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, lang)
    document.documentElement.lang = lang
  }, [lang])

  const t: I18n['t'] = (key, vars) =>
    dictionaries[lang][key].replace(/\{(\w+)\}/g, (_, name: string) => String(vars?.[name] ?? ''))

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n s’ha de fer servir dins d’I18nProvider')
  return ctx
}
