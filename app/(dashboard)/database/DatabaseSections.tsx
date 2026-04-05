"use client";

/**
 * Pagina Database — sezioni espandibili:
 * - Staff: lista + modale create/edit (GET/POST/PATCH /api/staff).
 * - Ruoli: lista + modale create/edit (GET/POST/PATCH /api/roles).
 * - Standard requirements: lista + modale create/edit (GET/POST/PATCH /api/standard-requirements).
 */

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { usePagePermissions } from "@/hooks/usePagePermissions";
import {
  type StaffItem,
  createStaff,
  deleteStaff,
  fetchStaff,
  inviteStaff,
  updateStaff,
} from "@/lib/api/staff";
import { type Role, fetchRoles } from "@/lib/api/roles";
import {
  type StandardRequirementWithRole,
  fetchStandardRequirements,
} from "@/lib/api/standardRequirements";

/** Usate quando si ripristinano POST/PATCH su staff/ruoli/standard (evita import “unused”). */
const _databaseApiReadRef = {
  fetchStaff,
  fetchRoles,
  fetchStandardRequirements,
};
void _databaseApiReadRef;

const ROLE_LOCATION_OPTIONS = [
  "STADIO",
  "COLOGNO",
  "LEEDS",
  "REMOTE",
] as const;

const STAFF_DEFAULT_LOCATION_OPTIONS = ROLE_LOCATION_OPTIONS;

const USER_LEVEL_OPTIONS = [
  "FREELANCE",
  "STAFF",
  "MANAGER",
  "MASTER",
] as const;

type RoleFormValues = {
  roleCode: string;
  name: string;
  location: string;
  description: string;
  active: boolean;
};

type StaffFormValues = {
  surname: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  defaultRoleCode: string;
  defaultLocation: string;
  userLevel: string;
  fee: string;
  plates: string;
  active: boolean;
};

const PRIMARY_BTN_SM =
  "rounded bg-pitch-accent px-3 py-1.5 text-xs font-semibold text-pitch-bg hover:bg-yellow-200 disabled:cursor-not-allowed disabled:opacity-50";

const STD_REQ_SITE_OPTIONS = [
  "STADIO",
  "COLOGNO",
  "GALLERY",
  "VMIX",
  "OFFTUBE",
  "LEEDS",
  "REMOTE",
] as const;

type StdReqFormValues = {
  standardOnsite: string;
  standardCologno: string;
  site: string;
  areaProduzione: string;
  roleId: number | "";
  quantity: string;
  notes: string;
};

function emptyStdReqForm(): StdReqFormValues {
  return {
    standardOnsite: "",
    standardCologno: "",
    site: "STADIO",
    areaProduzione: "",
    roleId: "",
    quantity: "1",
    notes: "",
  };
}

interface DatabaseSectionsProps {
  staff: StaffItem[];
  roles: Role[];
  standardRequirements: StandardRequirementWithRole[];
  roleMap: Record<string, string>;
}

function emptyRoleForm(): RoleFormValues {
  return {
    roleCode: "",
    name: "",
    location: "STADIO",
    description: "",
    active: true,
  };
}

function roleToForm(role: Role): RoleFormValues {
  return {
    roleCode: role.code,
    name: role.name ?? "",
    location: role.location,
    description: role.description ?? "",
    active: role.active,
  };
}

function CollapsibleSection({
  title,
  description,
  open,
  onToggle,
  children,
}: {
  title: string;
  description?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6 rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/20">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-lg font-semibold text-pitch-white hover:bg-pitch-gray-dark/50"
      >
        {title}
        <span className="text-pitch-gray">
          {open ? "▼" : "▶"}
        </span>
      </button>
      {description ? (
        <p className="border-t border-pitch-gray-dark/60 px-4 py-2 text-xs leading-snug text-pitch-gray">
          {description}
        </p>
      ) : null}
      {open && <div className="border-t border-pitch-gray-dark p-4">{children}</div>}
    </section>
  );
}

export function DatabaseSections({
  staff: initialStaff,
  roles: initialRoles,
  standardRequirements: initialStandardRequirements,
  roleMap,
}: DatabaseSectionsProps) {
  const [staffOpen, setStaffOpen] = useState(true);
  const [rolesOpen, setRolesOpen] = useState(true);
  const [standardOpen, setStandardOpen] = useState(true);

  const [staff, setStaff] = useState<StaffItem[]>(initialStaff);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffItem | null>(null);
  const [staffFormError, setStaffFormError] = useState<string | null>(null);
  const [staffFormValues, setStaffFormValues] = useState<StaffFormValues>({
    surname: "",
    name: "",
    email: "",
    phone: "",
    company: "",
    defaultRoleCode: "",
    defaultLocation: "STADIO",
    userLevel: "FREELANCE",
    fee: "",
    plates: "",
    active: true,
  });
  const [savingStaff, setSavingStaff] = useState(false);
  const [invitingStaffId, setInvitingStaffId] = useState<number | null>(null);
  const [deletingStaffId, setDeletingStaffId] = useState<number | null>(null);

  const { levelByPageKey } = usePagePermissions();
  const canEditDatabase = levelByPageKey.database === "edit";

  const [roles, setRoles] = useState<Role[]>(initialRoles);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleFormError, setRoleFormError] = useState<string | null>(null);
  const [roleFormValues, setRoleFormValues] =
    useState<RoleFormValues>(emptyRoleForm);
  const [savingRole, setSavingRole] = useState(false);

  const [standardRequirements, setStandardRequirements] = useState<
    StandardRequirementWithRole[]
  >(initialStandardRequirements);
  const [isStdReqModalOpen, setIsStdReqModalOpen] = useState(false);
  const [editingStdReq, setEditingStdReq] =
    useState<StandardRequirementWithRole | null>(null);
  const [stdReqFormError, setStdReqFormError] = useState<string | null>(null);
  const [stdReqFormValues, setStdReqFormValues] = useState<StdReqFormValues>(
    emptyStdReqForm
  );
  const [savingStdReq, setSavingStdReq] = useState(false);

  useEffect(() => {
    setStaff(initialStaff);
  }, [initialStaff]);

  useEffect(() => {
    setRoles(initialRoles);
  }, [initialRoles]);

  useEffect(() => {
    setStandardRequirements(initialStandardRequirements);
  }, [initialStandardRequirements]);

  const effectiveRoleMap = useMemo(
    () => ({
      ...roleMap,
      ...Object.fromEntries(roles.map((r) => [r.code, r.name])),
    }),
    [roleMap, roles]
  );

  const staffDefaultLocationSelectOptions = useMemo(() => {
    const set = new Set<string>([...STAFF_DEFAULT_LOCATION_OPTIONS]);
    if (editingStaff?.default_location)
      set.add(editingStaff.default_location);
    if (staffFormValues.defaultLocation)
      set.add(staffFormValues.defaultLocation);
    return [...set];
  }, [editingStaff, staffFormValues.defaultLocation]);

  const userLevelSelectOptions = useMemo(() => {
    const ordered = [...USER_LEVEL_OPTIONS];
    const canonical = new Set<string>(ordered);
    const extras: string[] = [];
    if (
      editingStaff?.user_level &&
      !canonical.has(editingStaff.user_level)
    ) {
      extras.push(editingStaff.user_level);
    }
    if (
      staffFormValues.userLevel &&
      !canonical.has(staffFormValues.userLevel)
    ) {
      extras.push(staffFormValues.userLevel);
    }
    const uniqueExtras = [...new Set(extras)].sort();
    return [...ordered, ...uniqueExtras];
  }, [editingStaff, staffFormValues.userLevel]);

  useEffect(() => {
    if (!isRoleModalOpen) return;
    setRoleFormValues(
      editingRole ? roleToForm(editingRole) : emptyRoleForm()
    );
  }, [isRoleModalOpen, editingRole]);

  const locationSelectOptions = useMemo(() => {
    const set = new Set<string>([...ROLE_LOCATION_OPTIONS]);
    if (editingRole?.location) set.add(editingRole.location);
    return [...set];
  }, [editingRole]);

  const stdReqSiteSelectOptions = useMemo(() => {
    const set = new Set<string>([...STD_REQ_SITE_OPTIONS]);
    if (editingStdReq?.site) set.add(editingStdReq.site);
    if (stdReqFormValues.site) set.add(stdReqFormValues.site);
    return [...set];
  }, [editingStdReq, stdReqFormValues.site]);

  const rolesSortedForSelect = useMemo(
    () =>
      [...roles].sort((a, b) =>
        (a.name || a.code).localeCompare(b.name || b.code, "it")
      ),
    [roles]
  );

  const handleSubmitRole = async (e: FormEvent) => {
    e.preventDefault();
    setRoleFormError(null);
    const code = roleFormValues.roleCode.trim();
    if (!code) {
      setRoleFormError("Il codice ruolo è obbligatorio.");
      return;
    }
    const nameTrim = roleFormValues.name.trim();
    const descTrim = roleFormValues.description.trim();
    setSavingRole(true);
    try {
      /* TODO: ripristinare quando createRole / updateRole sono esportati da @/lib/api/roles
      if (editingRole) {
        const updated = await updateRole(editingRole.id, {
          roleCode: code,
          name: nameTrim || undefined,
          location: roleFormValues.location,
          description: descTrim ? descTrim : null,
          active: roleFormValues.active,
        });
        setRoles((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      } else {
        const created = await createRole({
          roleCode: code,
          name: nameTrim || undefined,
          location: roleFormValues.location,
          description: descTrim ? descTrim : null,
          active: roleFormValues.active,
        });
        setRoles((prev) => [...prev, created]);
      }
      setIsRoleModalOpen(false);
      setEditingRole(null);
      */
      setRoleFormError(
        "Salvataggio ruoli temporaneamente disabilitato (createRole/updateRole non disponibili)."
      );
    } catch (err) {
      setRoleFormError(
        err instanceof Error ? err.message : "Errore nel salvataggio del ruolo."
      );
    } finally {
      setSavingRole(false);
    }
  };

  const handleSubmitStaff = async (e: FormEvent) => {
    e.preventDefault();
    setStaffFormError(null);

    const surname = staffFormValues.surname.trim();
    const name = staffFormValues.name.trim();
    const email = staffFormValues.email.trim();
    const defaultRoleCode = staffFormValues.defaultRoleCode.trim();
    const defaultLocation = staffFormValues.defaultLocation.trim();

    if (!surname || !name || !email || !defaultRoleCode || !defaultLocation) {
      setStaffFormError("Cognome, nome, email, ruolo e sede sono obbligatori.");
      return;
    }

    const feeNum = staffFormValues.fee.trim()
      ? Number(staffFormValues.fee.trim())
      : undefined;
    const feeValue =
      feeNum != null && Number.isFinite(feeNum) ? feeNum : undefined;

    setSavingStaff(true);
    try {
      if (editingStaff) {
        const updated = await updateStaff(editingStaff.id, {
          surname,
          name,
          email,
          defaultRoleCode,
          defaultLocation,
          userLevel: staffFormValues.userLevel || undefined,
          active: staffFormValues.active,
          phone: staffFormValues.phone.trim() || undefined,
          company: staffFormValues.company.trim() || undefined,
          fee: feeValue,
          plates: staffFormValues.plates.trim() || undefined,
        });
        setStaff((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      } else {
        const created = await createStaff({
          surname,
          name,
          email,
          defaultRoleCode,
          defaultLocation,
          userLevel: staffFormValues.userLevel || undefined,
          active: staffFormValues.active,
          phone: staffFormValues.phone.trim() || undefined,
          company: staffFormValues.company.trim() || undefined,
          fee: feeValue,
          plates: staffFormValues.plates.trim() || undefined,
        });
        setStaff((prev) => [...prev, created]);
      }
      setIsStaffModalOpen(false);
      setEditingStaff(null);
    } catch (err) {
      setStaffFormError(
        err instanceof Error
          ? err.message
          : "Errore nel salvataggio dell'anagrafica staff."
      );
    } finally {
      setSavingStaff(false);
    }
  };

  const handleInviteStaff = async (s: StaffItem) => {
    setInvitingStaffId(s.id);
    try {
      await inviteStaff(s.id);
      const fullName = `${s.name} ${s.surname}`.trim();
      alert(`Invito inviato a ${fullName}`);
    } catch (e) {
      alert(
        e instanceof Error
          ? e.message
          : "Errore durante l'invio dell'invito."
      );
    } finally {
      setInvitingStaffId(null);
    }
  };

  const handleDeleteStaff = async (s: StaffItem) => {
    const nomeCognome = `${s.name} ${s.surname}`.trim();
    const ok = window.confirm(
      `Vuoi eliminare ${nomeCognome} dalla rubrica? L'operazione non può essere annullata.`
    );
    if (!ok) return;

    setDeletingStaffId(s.id);
    try {
      await deleteStaff(s.id);
      const data = await fetchStaff({ limit: 100, offset: 0 });
      setStaff(data.items ?? []);
    } catch (e) {
      alert(
        e instanceof Error ? e.message : "Errore durante l'eliminazione."
      );
    } finally {
      setDeletingStaffId(null);
    }
  };

  const handleSubmitStdReq = async (e: FormEvent) => {
    e.preventDefault();
    setStdReqFormError(null);

    const onsite = stdReqFormValues.standardOnsite.trim();
    const cologno = stdReqFormValues.standardCologno.trim();
    if (!onsite || !cologno) {
      setStdReqFormError("Standard onsite e cologno sono obbligatori.");
      return;
    }
    const roleIdNum =
      stdReqFormValues.roleId === "" ? NaN : Number(stdReqFormValues.roleId);
    if (!Number.isFinite(roleIdNum) || roleIdNum < 1) {
      setStdReqFormError("Devi selezionare un ruolo valido.");
      return;
    }
    const qtyNum = parseInt(stdReqFormValues.quantity, 10);
    const safeQty = Number.isFinite(qtyNum) && qtyNum >= 1 ? qtyNum : 1;

    setSavingStdReq(true);
    try {
      /* TODO: ripristinare quando createStandardRequirement / updateStandardRequirement sono esportati
      if (editingStdReq) {
        const selectedRole = roles.find((r) => r.id === roleIdNum);
        const updated = await updateStandardRequirement(editingStdReq.id, {
          standardOnsite: onsite,
          standardCologno: cologno,
          site: stdReqFormValues.site,
          areaProduzione: stdReqFormValues.areaProduzione || undefined,
          roleId: roleIdNum,
          roleLocation: selectedRole?.location ?? "",
          quantity: safeQty,
          notes: stdReqFormValues.notes.trim() || undefined,
        });
        setStandardRequirements((prev) =>
          prev.map((r) => (r.id === updated.id ? updated : r))
        );
      } else {
        const selectedRoleNew = roles.find((r) => r.id === roleIdNum);
        const created = await createStandardRequirement({
          standardOnsite: onsite,
          standardCologno: cologno,
          site: stdReqFormValues.site,
          areaProduzione: stdReqFormValues.areaProduzione || undefined,
          roleId: roleIdNum,
          roleLocation: selectedRoleNew?.location ?? "",
          quantity: safeQty,
          notes: stdReqFormValues.notes.trim() || undefined,
        });
        setStandardRequirements((prev) => [...prev, created]);
      }
      setIsStdReqModalOpen(false);
      setEditingStdReq(null);
      */
      setStdReqFormError(
        "Salvataggio standard temporaneamente disabilitato (create/update non disponibili)."
      );
    } catch (err) {
      setStdReqFormError(
        err instanceof Error
          ? err.message
          : "Errore nel salvataggio dello standard."
      );
    } finally {
      setSavingStdReq(false);
    }
  };

  return (
    <>
      <CollapsibleSection
        title="Staff"
        description="Elenco persone con ruolo e sede predefiniti; usato in Designazioni e per la compatibilità ruolo–slot in assegnazione."
        open={staffOpen}
        onToggle={() => setStaffOpen(!staffOpen)}
      >
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            className={PRIMARY_BTN_SM}
            onClick={() => {
              setEditingStaff(null);
              setStaffFormError(null);
              setStaffFormValues({
                surname: "",
                name: "",
                email: "",
                phone: "",
                company: "",
                defaultRoleCode: "",
                defaultLocation: "STADIO",
                userLevel: "FREELANCE",
                fee: "",
                plates: "",
                active: true,
              });
              setIsStaffModalOpen(true);
            }}
          >
            Nuovo staff
          </button>
        </div>
        <div className="overflow-x-auto">
          {staff.length === 0 ? (
            <div className="rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/30 p-6 text-pitch-gray">
              Nessuno staff
            </div>
          ) : (
            <table className="w-full min-w-[880px] border-collapse">
              <thead>
                <tr className="border-b border-pitch-gray-dark">
                  <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                    Cognome
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                    Nome
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                    Telefono
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                    Azienda
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                    Ruolo
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                    Sede
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                    Fee
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                    Targa(e)
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                    User level
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                    Attivo
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                    Azioni
                  </th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-pitch-gray-dark/50 hover:bg-pitch-gray-dark/30"
                  >
                    <td className="px-4 py-3 text-sm text-pitch-white">
                      {s.surname}
                    </td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">
                      {s.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">
                      {s.email ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">
                      {s.phone ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">
                      {s.company ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">
                      {s.default_role_code
                        ? effectiveRoleMap[s.default_role_code] ??
                          s.default_role_code
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">
                      {s.default_location ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">
                      {s.fee ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">
                      {s.plates ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">
                      {s.user_level}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          s.active
                            ? "bg-green-900/50 text-green-300"
                            : "bg-pitch-gray-dark text-pitch-gray"
                        }`}
                      >
                        {s.active ? "Sì" : "No"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {canEditDatabase ? (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <button
                            type="button"
                            disabled={deletingStaffId === s.id}
                            className="text-xs text-pitch-accent underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={() => {
                              setEditingStaff(s);
                              setStaffFormError(null);
                              setStaffFormValues({
                                surname: s.surname ?? "",
                                name: s.name ?? "",
                                email: s.email ?? "",
                                phone: s.phone ?? "",
                                company: s.company ?? "",
                                defaultRoleCode: s.default_role_code ?? "",
                                defaultLocation: s.default_location ?? "STADIO",
                                userLevel: s.user_level ?? "FREELANCE",
                                fee: s.fee != null ? String(s.fee) : "",
                                plates: s.plates ?? "",
                                active: s.active ?? true,
                              });
                              setIsStaffModalOpen(true);
                            }}
                          >
                            Modifica
                          </button>
                          <button
                            type="button"
                            disabled={
                              invitingStaffId === s.id ||
                              deletingStaffId === s.id
                            }
                            className="inline-flex items-center gap-1 text-xs text-pitch-accent underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                            title="Invia invito"
                            onClick={() => void handleInviteStaff(s)}
                          >
                            <span aria-hidden>✉</span>
                            {invitingStaffId === s.id ? "Invio…" : "Invita"}
                          </button>
                          <button
                            type="button"
                            disabled={
                              deletingStaffId === s.id ||
                              invitingStaffId === s.id
                            }
                            className="inline-flex items-center gap-1 text-xs text-pitch-accent underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                            title="Elimina dalla rubrica"
                            onClick={() => void handleDeleteStaff(s)}
                          >
                            <span aria-hidden>🗑</span>
                            {deletingStaffId === s.id ? "Eliminazione…" : "Elimina"}
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-pitch-gray">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Ruoli"
        description="Catalogo ruoli di produzione (codice, nome, sede tipo Stadio/Cologno); base per gli slot e per il default ruolo dello staff."
        open={rolesOpen}
        onToggle={() => setRolesOpen(!rolesOpen)}
      >
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            className={PRIMARY_BTN_SM}
            onClick={() => {
              setEditingRole(null);
              setRoleFormError(null);
              setIsRoleModalOpen(true);
            }}
          >
            Nuovo ruolo
          </button>
        </div>
        <div className="overflow-x-auto">
          {roles.length === 0 ? (
            <div className="rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/30 p-6 text-pitch-gray">
              Nessun ruolo
            </div>
          ) : (
            <table className="w-full min-w-[680px] border-collapse">
              <thead>
                <tr className="border-b border-pitch-gray-dark">
                  <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                    Code
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                    Location
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                    Description
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                    Active
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                    Azioni
                  </th>
                </tr>
              </thead>
              <tbody>
                {roles.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-pitch-gray-dark/50 hover:bg-pitch-gray-dark/30"
                  >
                    <td className="px-4 py-3 text-sm text-pitch-white">
                      {r.code}
                    </td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">
                      {r.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">
                      {r.location}
                    </td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">
                      {r.description ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          r.active
                            ? "bg-green-900/50 text-green-300"
                            : "bg-pitch-gray-dark text-pitch-gray"
                        }`}
                      >
                        {r.active ? "Sì" : "No"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="text-xs text-pitch-accent underline-offset-2 hover:underline"
                        onClick={() => {
                          setEditingRole(r);
                          setRoleFormError(null);
                          setIsRoleModalOpen(true);
                        }}
                      >
                        Modifica
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </CollapsibleSection>

      {isRoleModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="presentation"
          onClick={() => {
            if (!savingRole) {
              setIsRoleModalOpen(false);
              setEditingRole(null);
              setRoleFormError(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="role-modal-title"
            className="w-full max-w-md rounded-lg border border-pitch-gray-dark bg-pitch-bg p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="role-modal-title"
              className="text-lg font-semibold text-pitch-white"
            >
              {editingRole ? "Modifica ruolo" : "Nuovo ruolo"}
            </h2>
            {roleFormError ? (
              <p className="mt-3 rounded border border-red-900/50 bg-red-950/40 px-3 py-2 text-xs text-red-200">
                {roleFormError}
              </p>
            ) : null}
            <form className="mt-4 space-y-3" onSubmit={handleSubmitRole}>
              <div>
                <label
                  htmlFor="role-code"
                  className="mb-1 block text-xs text-pitch-gray"
                >
                  Codice ruolo <span className="text-red-400">*</span>
                </label>
                <input
                  id="role-code"
                  type="text"
                  required
                  value={roleFormValues.roleCode}
                  onChange={(e) =>
                    setRoleFormValues((v) => ({
                      ...v,
                      roleCode: e.target.value,
                    }))
                  }
                  onBlur={() =>
                    setRoleFormValues((v) => ({
                      ...v,
                      roleCode: v.roleCode.trim().toUpperCase(),
                    }))
                  }
                  className="w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="role-name"
                  className="mb-1 block text-xs text-pitch-gray"
                >
                  Nome (opzionale)
                </label>
                <input
                  id="role-name"
                  type="text"
                  placeholder="(uguale a codice se vuoto)"
                  value={roleFormValues.name}
                  onChange={(e) =>
                    setRoleFormValues((v) => ({ ...v, name: e.target.value }))
                  }
                  className="w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="role-location"
                  className="mb-1 block text-xs text-pitch-gray"
                >
                  Sede
                </label>
                <select
                  id="role-location"
                  value={roleFormValues.location}
                  onChange={(e) =>
                    setRoleFormValues((v) => ({
                      ...v,
                      location: e.target.value,
                    }))
                  }
                  className="w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
                >
                  {locationSelectOptions.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="role-description"
                  className="mb-1 block text-xs text-pitch-gray"
                >
                  Descrizione
                </label>
                <textarea
                  id="role-description"
                  rows={3}
                  value={roleFormValues.description}
                  onChange={(e) =>
                    setRoleFormValues((v) => ({
                      ...v,
                      description: e.target.value,
                    }))
                  }
                  className="w-full resize-y rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
                />
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-pitch-gray-light">
                <input
                  type="checkbox"
                  checked={roleFormValues.active}
                  onChange={(e) =>
                    setRoleFormValues((v) => ({
                      ...v,
                      active: e.target.checked,
                    }))
                  }
                  className="rounded border-pitch-gray-dark"
                />
                Attivo
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="rounded border border-pitch-gray px-3 py-1.5 text-xs text-pitch-gray-light hover:bg-pitch-gray-dark disabled:opacity-50"
                  disabled={savingRole}
                  onClick={() => {
                    setIsRoleModalOpen(false);
                    setEditingRole(null);
                    setRoleFormError(null);
                  }}
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className={PRIMARY_BTN_SM}
                  disabled={savingRole}
                >
                  {savingRole ? "Salvataggio…" : "Salva"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <CollapsibleSection
        title="Standard requirements"
        description="Template di crew per coppie standard onsite/Cologno (e sede/area); il backend li usa per generare gli slot di designazione sugli eventi."
        open={standardOpen}
        onToggle={() => setStandardOpen(!standardOpen)}
      >
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            className={PRIMARY_BTN_SM}
            onClick={() => {
              setEditingStdReq(null);
              setStdReqFormError(null);
              setStdReqFormValues({
                standardOnsite: "",
                standardCologno: "",
                site: "STADIO",
                areaProduzione: "",
                roleId: "",
                quantity: "1",
                notes: "",
              });
              setIsStdReqModalOpen(true);
            }}
          >
            Nuovo standard
          </button>
        </div>
        <div className="overflow-x-auto">
          {standardRequirements.length === 0 ? (
            <div className="rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/30 p-6 text-pitch-gray">
              Nessun standard requirement
            </div>
          ) : (
            <table className="w-full min-w-[780px] border-collapse">
              <thead>
                <tr className="border-b border-pitch-gray-dark">
                  <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                    Standard onsite
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                    Standard Cologno
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                    Sede
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                    Area produzione
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                    Ruolo
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-pitch-gray">
                    Qty
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                    Notes
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                    Azioni
                  </th>
                </tr>
              </thead>
              <tbody>
                {standardRequirements.map((req) => (
                  <tr
                    key={req.id}
                    className="border-b border-pitch-gray-dark/50 hover:bg-pitch-gray-dark/30"
                  >
                    <td className="px-4 py-3 text-sm text-pitch-white">
                      {req.standardOnsite}
                    </td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">
                      {req.standardCologno}
                    </td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">
                      {req.site}
                    </td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">
                      {req.areaProduzione}
                    </td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">
                      {req.roleCode} – {req.roleName}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-pitch-gray-light">
                      {req.quantity}
                    </td>
                    <td className="px-4 py-3 text-sm text-pitch-gray">
                      {req.notes ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="text-xs text-pitch-accent underline-offset-2 hover:underline"
                        onClick={() => {
                          setEditingStdReq(req);
                          setStdReqFormError(null);
                          setStdReqFormValues({
                            standardOnsite: req.standardOnsite ?? "",
                            standardCologno: req.standardCologno ?? "",
                            site: req.site ?? "STADIO",
                            areaProduzione: req.areaProduzione ?? "",
                            roleId: req.roleId,
                            quantity: String(req.quantity ?? 1),
                            notes: req.notes ?? "",
                          });
                          setIsStdReqModalOpen(true);
                        }}
                      >
                        Modifica
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </CollapsibleSection>

      {isStdReqModalOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
          role="presentation"
          onClick={() => {
            if (!savingStdReq) {
              setIsStdReqModalOpen(false);
              setEditingStdReq(null);
              setStdReqFormError(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="std-req-modal-title"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-pitch-gray-dark bg-pitch-bg p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="std-req-modal-title"
              className="text-lg font-semibold text-pitch-white"
            >
              {editingStdReq ? "Modifica standard" : "Nuovo standard"}
            </h2>
            {stdReqFormError ? (
              <p className="mt-3 rounded border border-red-900/50 bg-red-950/40 px-3 py-2 text-xs text-red-200">
                {stdReqFormError}
              </p>
            ) : null}
            <form className="mt-4 space-y-3" onSubmit={handleSubmitStdReq}>
              <div>
                <label
                  htmlFor="std-onsite"
                  className="mb-1 block text-xs text-pitch-gray"
                >
                  Standard onsite <span className="text-red-400">*</span>
                </label>
                <input
                  id="std-onsite"
                  type="text"
                  required
                  value={stdReqFormValues.standardOnsite}
                  onChange={(e) =>
                    setStdReqFormValues((v) => ({
                      ...v,
                      standardOnsite: e.target.value,
                    }))
                  }
                  className="w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="std-cologno"
                  className="mb-1 block text-xs text-pitch-gray"
                >
                  Standard Cologno <span className="text-red-400">*</span>
                </label>
                <input
                  id="std-cologno"
                  type="text"
                  required
                  value={stdReqFormValues.standardCologno}
                  onChange={(e) =>
                    setStdReqFormValues((v) => ({
                      ...v,
                      standardCologno: e.target.value,
                    }))
                  }
                  className="w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="std-site"
                  className="mb-1 block text-xs text-pitch-gray"
                >
                  Sede
                </label>
                <select
                  id="std-site"
                  value={stdReqFormValues.site}
                  onChange={(e) =>
                    setStdReqFormValues((v) => ({
                      ...v,
                      site: e.target.value,
                    }))
                  }
                  className="w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
                >
                  {stdReqSiteSelectOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="std-area"
                  className="mb-1 block text-xs text-pitch-gray"
                >
                  Area produzione
                </label>
                <input
                  id="std-area"
                  type="text"
                  value={stdReqFormValues.areaProduzione}
                  onChange={(e) =>
                    setStdReqFormValues((v) => ({
                      ...v,
                      areaProduzione: e.target.value,
                    }))
                  }
                  className="w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="std-role"
                  className="mb-1 block text-xs text-pitch-gray"
                >
                  Ruolo <span className="text-red-400">*</span>
                </label>
                <select
                  id="std-role"
                  required
                  value={
                    stdReqFormValues.roleId === ""
                      ? ""
                      : String(stdReqFormValues.roleId)
                  }
                  onChange={(e) => {
                    const v = e.target.value;
                    setStdReqFormValues((prev) => ({
                      ...prev,
                      roleId: v === "" ? "" : Number(v),
                    }));
                  }}
                  className="w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
                >
                  <option value="">Seleziona ruolo…</option>
                  {rolesSortedForSelect.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.code} — {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="std-qty"
                  className="mb-1 block text-xs text-pitch-gray"
                >
                  Quantità
                </label>
                <input
                  id="std-qty"
                  type="number"
                  min={1}
                  value={stdReqFormValues.quantity}
                  onChange={(e) =>
                    setStdReqFormValues((v) => ({
                      ...v,
                      quantity: e.target.value,
                    }))
                  }
                  className="w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="std-notes"
                  className="mb-1 block text-xs text-pitch-gray"
                >
                  Note
                </label>
                <textarea
                  id="std-notes"
                  rows={3}
                  value={stdReqFormValues.notes}
                  onChange={(e) =>
                    setStdReqFormValues((v) => ({
                      ...v,
                      notes: e.target.value,
                    }))
                  }
                  className="w-full resize-y rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="rounded border border-pitch-gray px-3 py-1.5 text-xs text-pitch-gray-light hover:bg-pitch-gray-dark disabled:opacity-50"
                  disabled={savingStdReq}
                  onClick={() => {
                    setIsStdReqModalOpen(false);
                    setEditingStdReq(null);
                    setStdReqFormError(null);
                  }}
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className={PRIMARY_BTN_SM}
                  disabled={savingStdReq}
                >
                  {savingStdReq ? "Salvataggio…" : "Salva"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isStaffModalOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
          role="presentation"
          onClick={() => {
            if (!savingStaff) {
              setIsStaffModalOpen(false);
              setEditingStaff(null);
              setStaffFormError(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="staff-modal-title"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-pitch-gray-dark bg-pitch-bg p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="staff-modal-title"
              className="text-lg font-semibold text-pitch-white"
            >
              {editingStaff ? "Modifica staff" : "Nuovo staff"}
            </h2>
            {staffFormError ? (
              <p className="mt-3 rounded border border-red-900/50 bg-red-950/40 px-3 py-2 text-xs text-red-200">
                {staffFormError}
              </p>
            ) : null}
            <form className="mt-4 space-y-3" onSubmit={handleSubmitStaff}>
              <div>
                <label
                  htmlFor="staff-surname"
                  className="mb-1 block text-xs text-pitch-gray"
                >
                  Cognome <span className="text-red-400">*</span>
                </label>
                <input
                  id="staff-surname"
                  type="text"
                  required
                  value={staffFormValues.surname}
                  onChange={(e) =>
                    setStaffFormValues((v) => ({
                      ...v,
                      surname: e.target.value,
                    }))
                  }
                  className="w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="staff-name"
                  className="mb-1 block text-xs text-pitch-gray"
                >
                  Nome <span className="text-red-400">*</span>
                </label>
                <input
                  id="staff-name"
                  type="text"
                  required
                  value={staffFormValues.name}
                  onChange={(e) =>
                    setStaffFormValues((v) => ({ ...v, name: e.target.value }))
                  }
                  className="w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="staff-email"
                  className="mb-1 block text-xs text-pitch-gray"
                >
                  Email <span className="text-red-400">*</span>
                </label>
                <input
                  id="staff-email"
                  type="email"
                  required
                  value={staffFormValues.email}
                  onChange={(e) =>
                    setStaffFormValues((v) => ({
                      ...v,
                      email: e.target.value,
                    }))
                  }
                  className="w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="staff-phone"
                  className="mb-1 block text-xs text-pitch-gray"
                >
                  Telefono
                </label>
                <input
                  id="staff-phone"
                  type="text"
                  value={staffFormValues.phone}
                  onChange={(e) =>
                    setStaffFormValues((v) => ({
                      ...v,
                      phone: e.target.value,
                    }))
                  }
                  className="w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="staff-company"
                  className="mb-1 block text-xs text-pitch-gray"
                >
                  Azienda
                </label>
                <input
                  id="staff-company"
                  type="text"
                  value={staffFormValues.company}
                  onChange={(e) =>
                    setStaffFormValues((v) => ({
                      ...v,
                      company: e.target.value,
                    }))
                  }
                  className="w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="staff-default-role"
                  className="mb-1 block text-xs text-pitch-gray"
                >
                  Ruolo predefinito <span className="text-red-400">*</span>
                </label>
                <select
                  id="staff-default-role"
                  required
                  value={staffFormValues.defaultRoleCode}
                  onChange={(e) =>
                    setStaffFormValues((v) => ({
                      ...v,
                      defaultRoleCode: e.target.value,
                    }))
                  }
                  className="w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
                >
                  <option value="">Seleziona ruolo…</option>
                  {rolesSortedForSelect.map((r) => (
                    <option key={r.id} value={r.code}>
                      {r.code} — {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="staff-default-loc"
                  className="mb-1 block text-xs text-pitch-gray"
                >
                  Sede predefinita <span className="text-red-400">*</span>
                </label>
                <select
                  id="staff-default-loc"
                  required
                  value={staffFormValues.defaultLocation}
                  onChange={(e) =>
                    setStaffFormValues((v) => ({
                      ...v,
                      defaultLocation: e.target.value,
                    }))
                  }
                  className="w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
                >
                  {staffDefaultLocationSelectOptions.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="staff-user-level"
                  className="mb-1 block text-xs text-pitch-gray"
                >
                  User level
                </label>
                <select
                  id="staff-user-level"
                  value={staffFormValues.userLevel}
                  onChange={(e) =>
                    setStaffFormValues((v) => ({
                      ...v,
                      userLevel: e.target.value,
                    }))
                  }
                  className="w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
                >
                  {userLevelSelectOptions.map((lvl) => (
                    <option key={lvl} value={lvl}>
                      {lvl}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="staff-fee"
                  className="mb-1 block text-xs text-pitch-gray"
                >
                  Fee
                </label>
                <input
                  id="staff-fee"
                  type="number"
                  value={staffFormValues.fee}
                  onChange={(e) =>
                    setStaffFormValues((v) => ({ ...v, fee: e.target.value }))
                  }
                  className="w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="staff-plates"
                  className="mb-1 block text-xs text-pitch-gray"
                >
                  Targhe
                </label>
                <input
                  id="staff-plates"
                  type="text"
                  value={staffFormValues.plates}
                  onChange={(e) =>
                    setStaffFormValues((v) => ({
                      ...v,
                      plates: e.target.value,
                    }))
                  }
                  className="w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
                />
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-pitch-gray-light">
                <input
                  type="checkbox"
                  checked={staffFormValues.active}
                  onChange={(e) =>
                    setStaffFormValues((v) => ({
                      ...v,
                      active: e.target.checked,
                    }))
                  }
                  className="rounded border-pitch-gray-dark"
                />
                Attivo
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="rounded border border-pitch-gray px-3 py-1.5 text-xs text-pitch-gray-light hover:bg-pitch-gray-dark disabled:opacity-50"
                  disabled={savingStaff}
                  onClick={() => {
                    setIsStaffModalOpen(false);
                    setEditingStaff(null);
                    setStaffFormError(null);
                  }}
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className={PRIMARY_BTN_SM}
                  disabled={savingStaff}
                >
                  {savingStaff ? "Salvataggio…" : "Salva"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
