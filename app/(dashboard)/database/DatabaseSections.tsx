"use client";

/**
 * Pagina Database — sezioni espandibili:
 * - Staff: lista + modale create/edit (GET/POST/PATCH /api/staff).
 * - Ruoli: lista + modale create/edit (GET/POST/PATCH /api/roles).
 * - Pacchetti standard: lista combo + CRUD /api/standard-combos.
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
import {
  type Role,
  createRole,
  fetchRoles,
  updateRole,
} from "@/lib/api/roles";
import {
  type ComboRequirementInput,
  type StandardComboWithRequirements,
  createStandardCombo,
  deleteStandardCombo,
  fetchStandardCombos,
  updateStandardCombo,
} from "@/lib/api/standardCombos";
import { LookupValuesSection } from "./LookupValuesSection";
import { EventRulesSection } from "./EventRulesSection";
import {
  DB_TH,
  DB_TBODY_TR,
  DB_TD,
  DB_TD_EMPTY,
} from "./dbSectionStyles";

/** Usate quando si ripristinano POST/PATCH su staff/ruoli (evita import “unused”). */
const _databaseApiReadRef = {
  fetchStaff,
  fetchRoles,
  fetchStandardCombos,
  createRole,
  updateRole,
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

const STAFF_PAGE_SIZE = 50;

function staffDateToInputValue(raw: string | null | undefined): string {
  if (!raw) return "";
  const s = String(raw).trim();
  return s.length >= 10 ? s.slice(0, 10) : s;
}

/** Ordine alfabetico per etichette sede / livello (locale neutra, maiuscole). */
function sortAsc(values: readonly string[]): string[] {
  return [...values].sort((a, b) =>
    a.localeCompare(b, "en", { sensitivity: "base" })
  );
}

function staffNotesPreview(notes: string | null | undefined): {
  text: string;
  title?: string;
  empty: boolean;
} {
  const t = (notes ?? "").trim();
  if (!t) return { text: "—", empty: true };
  if (t.length <= 30) return { text: t, empty: false };
  return { text: `${t.slice(0, 30)}…`, title: t, empty: false };
}

/** Data di nascita in tabella: YYYY-MM-DD → DD/MM/YYYY. */
function formatBirthDateDisplay(raw: string | null | undefined): string {
  if (raw == null || String(raw).trim() === "") return "—";
  const s = String(raw).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return s;
}

function splitPlatesToThree(raw: string | null | undefined): [
  string,
  string,
  string,
] {
  const parts = (raw ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  return [parts[0] ?? "", parts[1] ?? "", parts[2] ?? ""];
}

function joinPlatesFromThree(
  a: string,
  b: string,
  c: string
): string | undefined {
  const parts = [a, b, c].map((x) => x.trim()).filter(Boolean);
  if (parts.length === 0) return undefined;
  return parts.join(", ");
}

function platesTableDisplay(raw: string | null | undefined): {
  text: string;
  empty: boolean;
} {
  const parts = (raw ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return { text: "—", empty: true };
  return { text: parts.join(" · "), empty: false };
}

type RoleFormValues = {
  roleCode: string;
  name: string;
  location: string;
  description: string;
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
  plate1: string;
  plate2: string;
  plate3: string;
  active: boolean;
  placeOfBirth: string;
  dateOfBirth: string;
  residentialAddress: string;
  idNumber: string;
  extraFee: string;
  teamDazn: string;
  staffNotes: string;
  financeVisibility: boolean;
};

const PRIMARY_BTN_SM =
  "rounded bg-pitch-accent px-3 py-1.5 text-xs font-semibold text-pitch-bg hover:bg-yellow-200 disabled:cursor-not-allowed disabled:opacity-50";

const COMBO_ROLE_LOCATION_OPTIONS = ["STADIO", "COLOGNO", "REMOTE"] as const;
const COMBO_ROLE_LOCATION_SORTED = sortAsc([...COMBO_ROLE_LOCATION_OPTIONS]);

const DB_BADGE_ON =
  "inline-flex rounded-full px-2 py-0.5 text-xs font-medium text-white bg-[#639922]";
const DB_BADGE_OFF =
  "inline-flex rounded-full px-2 py-0.5 text-xs font-medium text-white bg-[#E24B4A]";

type ComboHeaderFormValues = {
  standardOnsite: string;
  standardCologno: string;
  facilities: string;
  studio: string;
  notes: string;
};

type ComboRoleRowForm = {
  rowId: string;
  roleCode: string;
  roleLocation: string;
  quantity: string;
  notes: string;
};

function emptyComboHeader(): ComboHeaderFormValues {
  return {
    standardOnsite: "",
    standardCologno: "",
    facilities: "",
    studio: "",
    notes: "",
  };
}

function newRoleRow(): ComboRoleRowForm {
  return {
    rowId:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `r-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    roleCode: "",
    roleLocation: "STADIO",
    quantity: "1",
    notes: "",
  };
}

interface DatabaseSectionsProps {
  staff: StaffItem[];
  staffTotal: number;
  roles: Role[];
  standardCombos: StandardComboWithRequirements[];
  roleMap: Record<string, string>;
}

function emptyRoleForm(): RoleFormValues {
  return {
    roleCode: "",
    name: "",
    location: "STADIO",
    description: "",
  };
}

function roleToForm(role: Role): RoleFormValues {
  return {
    roleCode: role.code,
    name: role.name ?? "",
    location: role.location,
    description: role.description ?? "",
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
  staffTotal: initialStaffTotal,
  roles: initialRoles,
  standardCombos: initialStandardCombos,
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
    plate1: "",
    plate2: "",
    plate3: "",
    active: true,
    placeOfBirth: "",
    dateOfBirth: "",
    residentialAddress: "",
    idNumber: "",
    extraFee: "",
    teamDazn: "",
    staffNotes: "",
    financeVisibility: false,
  });
  const [staffOffset, setStaffOffset] = useState(0);
  const [staffTotal, setStaffTotal] = useState(initialStaffTotal);
  const [staffLoadingMore, setStaffLoadingMore] = useState(false);
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

  const [standardCombos, setStandardCombos] = useState<
    StandardComboWithRequirements[]
  >(initialStandardCombos);
  const [expandedComboId, setExpandedComboId] = useState<number | null>(null);
  const [isComboModalOpen, setIsComboModalOpen] = useState(false);
  const [editingCombo, setEditingCombo] =
    useState<StandardComboWithRequirements | null>(null);
  const [comboHeaderForm, setComboHeaderForm] =
    useState<ComboHeaderFormValues>(emptyComboHeader);
  const [comboRoleRows, setComboRoleRows] = useState<ComboRoleRowForm[]>([]);
  const [comboFormError, setComboFormError] = useState<string | null>(null);
  const [savingCombo, setSavingCombo] = useState(false);
  const [deleteComboTarget, setDeleteComboTarget] =
    useState<StandardComboWithRequirements | null>(null);
  const [deletingCombo, setDeletingCombo] = useState(false);

  useEffect(() => {
    setStaff(initialStaff);
    setStaffOffset(0);
    setStaffTotal(initialStaffTotal);
  }, [initialStaff, initialStaffTotal]);

  useEffect(() => {
    setRoles(initialRoles);
  }, [initialRoles]);

  useEffect(() => {
    setStandardCombos(initialStandardCombos);
  }, [initialStandardCombos]);

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
    return sortAsc([...set]);
  }, [editingStaff, staffFormValues.defaultLocation]);

  const userLevelSelectOptions = useMemo(() => {
    const merged = new Set<string>([...USER_LEVEL_OPTIONS]);
    if (editingStaff?.user_level) merged.add(editingStaff.user_level);
    if (staffFormValues.userLevel) merged.add(staffFormValues.userLevel);
    return sortAsc([...merged]);
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
    return sortAsc([...set]);
  }, [editingRole]);

  const rolesSortedForSelect = useMemo(
    () =>
      [...roles].sort((a, b) =>
        (a.name || a.code).localeCompare(b.name || b.code, "it")
      ),
    [roles]
  );

  const staffRolePairInCatalog = useMemo(() => {
    const code = staffFormValues.defaultRoleCode.trim();
    const loc = staffFormValues.defaultLocation.trim();
    if (!code || !loc) return true;
    const composite = `${code}__${loc}`;
    return rolesSortedForSelect.some(
      (r) => `${r.code}__${r.location}` === composite
    );
  }, [
    rolesSortedForSelect,
    staffFormValues.defaultRoleCode,
    staffFormValues.defaultLocation,
  ]);

  const staffDefaultRoleSelectValue =
    staffFormValues.defaultRoleCode.trim() &&
    staffFormValues.defaultLocation.trim()
      ? `${staffFormValues.defaultRoleCode.trim()}__${staffFormValues.defaultLocation.trim()}`
      : "";

  const comboHeaderDatalistOptions = useMemo(() => {
    const onsite = sortAsc(
      [
        ...new Set(standardCombos.map((c) => c.standardOnsite)),
      ].filter((v) => v != null && String(v).trim() !== "")
    );
    const cologno = sortAsc(
      [
        ...new Set(standardCombos.map((c) => c.standardCologno)),
      ].filter((v) => v != null && String(v).trim() !== "")
    );
    const facilities = sortAsc(
      [
        ...new Set(standardCombos.map((c) => c.facilities).filter(Boolean)),
      ] as string[]
    );
    const studio = sortAsc([
      ...new Set(
        standardCombos
          .map((c) => c.studio)
          .filter((v): v is string => Boolean(v && v !== "-"))
      ),
    ]);
    return { onsite, cologno, facilities, studio };
  }, [standardCombos]);

  const handleSubmitRole = async (e: FormEvent) => {
    e.preventDefault();
    setRoleFormError(null);
    const code = roleFormValues.roleCode.trim();
    if (!code) {
      setRoleFormError("Role code is required.");
      return;
    }
    const nameTrim = roleFormValues.name.trim();
    const descTrim = roleFormValues.description.trim();
    const payload = {
      roleCode: code,
      name: nameTrim || undefined,
      location: roleFormValues.location,
      description: descTrim ? descTrim : null,
    };
    setSavingRole(true);
    try {
      if (editingRole) {
        await updateRole(editingRole.id, payload);
      } else {
        await createRole(payload);
      }
      const refreshed = await fetchRoles();
      setRoles(refreshed);
      setIsRoleModalOpen(false);
      setEditingRole(null);
    } catch (err) {
      setRoleFormError(
        err instanceof Error ? err.message : "Error saving role."
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
      setStaffFormError(
        "Last name, first name, email, role and location are required."
      );
      return;
    }

    const feeTrimmed = staffFormValues.fee.trim();
    const feeNum = feeTrimmed ? Number(feeTrimmed) : NaN;
    const feeForEdit =
      feeTrimmed === ""
        ? null
        : Number.isFinite(feeNum)
          ? feeNum
          : undefined;
    const feeForCreate = feeTrimmed === "" ? undefined : feeForEdit;

    const extraStaffFields = {
      placeOfBirth: staffFormValues.placeOfBirth.trim() || null,
      dateOfBirth: staffFormValues.dateOfBirth.trim() || null,
      residentialAddress: staffFormValues.residentialAddress.trim() || null,
      idNumber: staffFormValues.idNumber.trim() || null,
      extraFee: staffFormValues.extraFee.trim() || null,
      teamDazn: staffFormValues.teamDazn.trim() || null,
      notes: staffFormValues.staffNotes.trim() || null,
      financeVisibility: staffFormValues.financeVisibility
        ? ("VISIBLE" as const)
        : ("HIDDEN" as const),
    };

    const platesJoined = joinPlatesFromThree(
      staffFormValues.plate1,
      staffFormValues.plate2,
      staffFormValues.plate3
    );

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
          fee: feeForEdit,
          plates: platesJoined ?? null,
          ...extraStaffFields,
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
          fee: feeForCreate,
          plates: platesJoined,
          ...extraStaffFields,
        });
        setStaff((prev) => [...prev, created]);
      }
      setIsStaffModalOpen(false);
      setEditingStaff(null);
    } catch (err) {
      setStaffFormError(
        err instanceof Error
          ? err.message
          : "Error saving staff profile."
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
          : "Error sending invite."
      );
    } finally {
      setInvitingStaffId(null);
    }
  };

  const handleDeleteStaff = async (s: StaffItem) => {
    const nomeCognome = `${s.name} ${s.surname}`.trim();
    const ok = window.confirm(
      `Remove ${nomeCognome} from the directory? This cannot be undone.`
    );
    if (!ok) return;

    setDeletingStaffId(s.id);
    try {
      await deleteStaff(s.id);
      const data = await fetchStaff({
        limit: STAFF_PAGE_SIZE,
        offset: 0,
      });
      setStaff(data.items ?? []);
      setStaffOffset(0);
      setStaffTotal(data.total ?? 0);
    } catch (e) {
      alert(
        e instanceof Error ? e.message : "Error deleting."
      );
    } finally {
      setDeletingStaffId(null);
    }
  };

  const openNewComboModal = () => {
    setEditingCombo(null);
    setComboFormError(null);
    setComboHeaderForm(emptyComboHeader());
    setComboRoleRows([newRoleRow()]);
    setIsComboModalOpen(true);
  };

  const openEditComboModal = (c: StandardComboWithRequirements) => {
    setEditingCombo(c);
    setComboFormError(null);
    setComboHeaderForm({
      standardOnsite: c.standardOnsite ?? "",
      standardCologno: c.standardCologno ?? "",
      facilities: c.facilities ?? "",
      studio: c.studio ?? "",
      notes: c.notes ?? "",
    });
    setComboRoleRows(
      c.requirements.length
        ? c.requirements.map((r) => ({
            rowId:
              typeof crypto !== "undefined" && "randomUUID" in crypto
                ? crypto.randomUUID()
                : `e-${r.id}`,
            roleCode: r.roleCode ?? "",
            roleLocation: (r.roleLocation ?? "STADIO").toUpperCase(),
            quantity: String(r.quantity ?? 1),
            notes: r.notes ?? "",
          }))
        : [newRoleRow()]
    );
    setIsComboModalOpen(true);
  };

  const handleSubmitCombo = async (e: FormEvent) => {
    e.preventDefault();
    setComboFormError(null);

    const onsite = comboHeaderForm.standardOnsite.trim();
    const cologno = comboHeaderForm.standardCologno.trim();
    if (!onsite || !cologno) {
      setComboFormError("Standard onsite e Cologno sono obbligatori.");
      return;
    }

    const requirementsPayload: ComboRequirementInput[] = [];
    for (const row of comboRoleRows) {
      const rc = row.roleCode.trim();
      const rl = row.roleLocation.trim().toUpperCase();
      if (!rc || !rl) {
        setComboFormError("Ogni riga ruolo deve avere codice e sede.");
        return;
      }
      const q = parseInt(row.quantity, 10);
      const safeQ = Number.isFinite(q) && q >= 1 ? q : 1;
      requirementsPayload.push({
        roleCode: rc,
        roleLocation: rl,
        quantity: safeQ,
        coverageType: "FREELANCE",
        notes: row.notes.trim() || undefined,
      });
    }

    setSavingCombo(true);
    try {
      const facilities =
        comboHeaderForm.facilities.trim() || null;
      const studio = comboHeaderForm.studio.trim() || null;
      const notes = comboHeaderForm.notes.trim() || null;

      if (editingCombo) {
        const updated = await updateStandardCombo(editingCombo.id, {
          standardOnsite: onsite,
          standardCologno: cologno,
          facilities,
          studio,
          notes,
          requirements: requirementsPayload,
        });
        setStandardCombos((prev) =>
          prev.map((x) => (x.id === updated.id ? updated : x))
        );
      } else {
        const created = await createStandardCombo({
          standardOnsite: onsite,
          standardCologno: cologno,
          facilities,
          studio,
          notes,
          requirements: requirementsPayload,
        });
        setStandardCombos((prev) => [...prev, created].sort((a, b) => {
          const o = a.standardOnsite.localeCompare(b.standardOnsite, "it");
          if (o !== 0) return o;
          return a.standardCologno.localeCompare(b.standardCologno, "it");
        }));
      }
      setIsComboModalOpen(false);
      setEditingCombo(null);
    } catch (err) {
      setComboFormError(
        err instanceof Error
          ? err.message
          : "Error saving package."
      );
    } finally {
      setSavingCombo(false);
    }
  };

  const handleConfirmDeleteCombo = async () => {
    if (!deleteComboTarget) return;
    const id = deleteComboTarget.id;
    setDeletingCombo(true);
    try {
      await deleteStandardCombo(id);
      setStandardCombos((prev) => prev.filter((c) => c.id !== id));
      setDeleteComboTarget(null);
      if (expandedComboId === id) setExpandedComboId(null);
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "Error deleting."
      );
    } finally {
      setDeletingCombo(false);
    }
  };

  return (
    <>
      <CollapsibleSection
        title="Staff"
        description="Directory of people with default role and location; used in Assignments and for role–slot compatibility when assigning."
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
                plate1: "",
                plate2: "",
                plate3: "",
                active: true,
                placeOfBirth: "",
                dateOfBirth: "",
                residentialAddress: "",
                idNumber: "",
                extraFee: "",
                teamDazn: "",
                staffNotes: "",
                financeVisibility: false,
              });
              setIsStaffModalOpen(true);
            }}
          >
            New staff
          </button>
        </div>
        <div className="overflow-x-auto">
          {staff.length === 0 ? (
            <div className="rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/30 p-6 text-pitch-gray">
              No staff
            </div>
          ) : (
            <table className="w-full min-w-[1680px] border-collapse">
              <thead>
                <tr className="border-b border-[#2a2a2a]">
                  <th className={DB_TH}>Last name</th>
                  <th className={DB_TH}>First name</th>
                  <th className={DB_TH}>Email</th>
                  <th className={DB_TH}>Phone</th>
                  <th className={DB_TH}>Company</th>
                  <th className={DB_TH}>Role</th>
                  <th className={DB_TH}>Location</th>
                  <th className={DB_TH}>Fee</th>
                  <th className={DB_TH}>Plate(s)</th>
                  <th className={DB_TH}>User level</th>
                  <th className={DB_TH}>Extra fee</th>
                  <th className={DB_TH}>DAZN Team</th>
                  <th className={DB_TH}>Notes</th>
                  <th className={DB_TH}>Place of birth</th>
                  <th className={DB_TH}>Date of birth</th>
                  <th className={DB_TH}>Address</th>
                  <th className={DB_TH}>Document</th>
                  <th className={DB_TH}>Active</th>
                  <th className={DB_TH}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => {
                  const notePrev = staffNotesPreview(s.notes);
                  const platesDisp = platesTableDisplay(s.plates);
                  const dobStr = formatBirthDateDisplay(s.date_of_birth);
                  const roleLabel = s.default_role_code
                    ? effectiveRoleMap[s.default_role_code] ??
                      s.default_role_code
                    : null;
                  return (
                  <tr key={s.id} className={DB_TBODY_TR}>
                    <td className={DB_TD}>{s.surname}</td>
                    <td className={DB_TD}>{s.name}</td>
                    <td
                      className={
                        s.email ? DB_TD : DB_TD_EMPTY
                      }
                    >
                      {s.email ?? "—"}
                    </td>
                    <td
                      className={s.phone ? DB_TD : DB_TD_EMPTY}
                    >
                      {s.phone ?? "—"}
                    </td>
                    <td
                      className={s.company ? DB_TD : DB_TD_EMPTY}
                    >
                      {s.company ?? "—"}
                    </td>
                    <td
                      className={roleLabel ? DB_TD : DB_TD_EMPTY}
                    >
                      {roleLabel ?? "—"}
                    </td>
                    <td
                      className={
                        s.default_location ? DB_TD : DB_TD_EMPTY
                      }
                    >
                      {s.default_location ?? "—"}
                    </td>
                    <td
                      className={
                        s.fee != null && String(s.fee) !== ""
                          ? DB_TD
                          : DB_TD_EMPTY
                      }
                    >
                      {s.fee != null && String(s.fee) !== ""
                        ? String(s.fee)
                        : "—"}
                    </td>
                    <td
                      className={platesDisp.empty ? DB_TD_EMPTY : DB_TD}
                    >
                      {platesDisp.text}
                    </td>
                    <td className={DB_TD}>{s.user_level}</td>
                    <td
                      className={
                        s.extra_fee ? DB_TD : DB_TD_EMPTY
                      }
                    >
                      {s.extra_fee ?? "—"}
                    </td>
                    <td
                      className={
                        s.team_dazn ? DB_TD : DB_TD_EMPTY
                      }
                    >
                      {s.team_dazn ?? "—"}
                    </td>
                    <td
                      className={notePrev.empty ? DB_TD_EMPTY : DB_TD}
                      title={notePrev.title}
                    >
                      {notePrev.text}
                    </td>
                    <td
                      className={
                        s.place_of_birth ? DB_TD : DB_TD_EMPTY
                      }
                    >
                      {s.place_of_birth ?? "—"}
                    </td>
                    <td
                      className={
                        dobStr === "—" ? DB_TD_EMPTY : DB_TD
                      }
                    >
                      {dobStr}
                    </td>
                    <td
                      className={
                        s.residential_address ? DB_TD : DB_TD_EMPTY
                      }
                    >
                      {s.residential_address ?? "—"}
                    </td>
                    <td
                      className={s.id_number ? DB_TD : DB_TD_EMPTY}
                    >
                      {s.id_number ?? "—"}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={
                          s.active ? DB_BADGE_ON : DB_BADGE_OFF
                        }
                      >
                        {s.active ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
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
                                ...(() => {
                                  const [p1, p2, p3] = splitPlatesToThree(
                                    s.plates
                                  );
                                  return {
                                    plate1: p1,
                                    plate2: p2,
                                    plate3: p3,
                                  };
                                })(),
                                active: s.active ?? true,
                                placeOfBirth: s.place_of_birth ?? "",
                                dateOfBirth: staffDateToInputValue(
                                  s.date_of_birth
                                ),
                                residentialAddress: s.residential_address ?? "",
                                idNumber: s.id_number ?? "",
                                extraFee: s.extra_fee ?? "",
                                teamDazn: s.team_dazn ?? "",
                                staffNotes: s.notes ?? "",
                                financeVisibility: s.finance_visibility === "VISIBLE",
                              });
                              setIsStaffModalOpen(true);
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={
                              invitingStaffId === s.id ||
                              deletingStaffId === s.id
                            }
                            className="inline-flex items-center gap-1 text-xs text-pitch-accent underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                            title="Send invite"
                            onClick={() => void handleInviteStaff(s)}
                          >
                            <span aria-hidden>✉</span>
                            {invitingStaffId === s.id ? "Sending…" : "Invite"}
                          </button>
                          <button
                            type="button"
                            disabled={
                              deletingStaffId === s.id ||
                              invitingStaffId === s.id
                            }
                            className="inline-flex items-center gap-1 text-xs text-pitch-accent underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                            title="Remove from directory"
                            onClick={() => void handleDeleteStaff(s)}
                          >
                            <span aria-hidden>🗑</span>
                            {deletingStaffId === s.id ? "Deleting…" : "Delete"}
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-[#3F4547]">—</span>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        {staff.length < staffTotal && (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              disabled={staffLoadingMore}
              className={PRIMARY_BTN_SM}
              onClick={async () => {
                setStaffLoadingMore(true);
                try {
                  const newOffset = staffOffset + STAFF_PAGE_SIZE;
                  const data = await fetchStaff({
                    limit: STAFF_PAGE_SIZE,
                    offset: newOffset,
                  });
                  const items = data.items ?? [];
                  setStaff((prev) => [...prev, ...items]);
                  setStaffOffset(newOffset);
                  if (typeof data.total === "number") setStaffTotal(data.total);
                } catch (e) {
                  alert(
                    e instanceof Error
                      ? e.message
                      : "Error loading more records."
                  );
                } finally {
                  setStaffLoadingMore(false);
                }
              }}
            >
              {staffLoadingMore ? "Loading…" : "Load more"}
            </button>
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        title="Roles"
        description="Catalog of production roles (code, name, Stadio/Cologno location); basis for slots and staff default role."
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
            New role
          </button>
        </div>
        <div className="overflow-x-auto">
          {roles.length === 0 ? (
            <div className="rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/30 p-6 text-pitch-gray">
              No roles
            </div>
          ) : (
            <table className="w-full min-w-[520px] border-collapse">
              <thead>
                <tr className="border-b border-[#2a2a2a]">
                  <th className={DB_TH}>Code</th>
                  <th className={DB_TH}>Location</th>
                  <th className={DB_TH}>Description</th>
                  <th className={DB_TH}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((r) => (
                  <tr key={r.id} className={DB_TBODY_TR}>
                    <td className={DB_TD}>{r.code}</td>
                    <td className={DB_TD}>{r.location}</td>
                    <td
                      className={
                        r.description ? DB_TD : DB_TD_EMPTY
                      }
                    >
                      {r.description ?? "—"}
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        className="text-xs text-pitch-accent underline-offset-2 hover:underline"
                        onClick={() => {
                          setEditingRole(r);
                          setRoleFormError(null);
                          setIsRoleModalOpen(true);
                        }}
                      >
                        Edit
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
              {editingRole ? "Edit role" : "New role"}
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
                  Role code <span className="text-red-400">*</span>
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
                  Name (optional)
                </label>
                <input
                  id="role-name"
                  type="text"
                  placeholder="(same as code if empty)"
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
                  Location
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
                  Description
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
                  Cancel
                </button>
                <button
                  type="submit"
                  className={PRIMARY_BTN_SM}
                  disabled={savingRole}
                >
                  {savingRole ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <CollapsibleSection
        title="Standard packages"
        description="Each package groups onsite, Cologno, facilities and studio with the role list (quantity and coverage). Used in Assignments to build requirements."
        open={standardOpen}
        onToggle={() => setStandardOpen(!standardOpen)}
      >
        <div
          className="rounded-lg border border-[#2a2a2a] p-4"
          style={{ background: "#111" }}
        >
          <div className="mb-4 flex justify-end">
            {canEditDatabase ? (
              <button
                type="button"
                className={PRIMARY_BTN_SM}
                onClick={openNewComboModal}
              >
                New standard
              </button>
            ) : null}
          </div>
          {standardCombos.length === 0 ? (
            <div
              className="rounded-lg border border-[#2a2a2a] p-6 text-sm text-pitch-gray"
              style={{ background: "#1a1a1a" }}
            >
              No standard packages
            </div>
          ) : (
            <ul className="space-y-2">
              {standardCombos.map((combo) => {
                const expanded = expandedComboId === combo.id;
                const facRaw = combo.facilities?.trim() ?? "";
                const showFacilitiesBadge =
                  Boolean(facRaw) && facRaw !== "-";
                const studioRaw = combo.studio?.trim() ?? "";
                const showStudioBadge =
                  Boolean(studioRaw) && studioRaw !== "-";
                return (
                  <li
                    key={combo.id}
                    className="overflow-hidden rounded-lg border border-[#2a2a2a]"
                    style={{ background: "#1a1a1a" }}
                  >
                    <button
                      type="button"
                      className="flex w-full flex-wrap items-center gap-2 px-4 py-3 text-left transition hover:bg-black/30"
                      onClick={() =>
                        setExpandedComboId(expanded ? null : combo.id)
                      }
                    >
                      <span
                        className="rounded px-2 py-0.5 text-xs"
                        style={{
                          background: "#FFFA00",
                          color: "#000",
                          fontWeight: 700,
                        }}
                      >
                        {combo.standardOnsite}
                      </span>
                      <span
                        className="rounded px-2 py-0.5 text-xs"
                        style={{
                          background: "#3F4547",
                          color: "#fff",
                          fontWeight: 700,
                        }}
                      >
                        {combo.standardCologno}
                      </span>
                      {showFacilitiesBadge ? (
                        <span
                          className="rounded px-2 py-0.5 text-xs"
                          style={{
                            background: "#2a2a2a",
                            color: "#868A8C",
                            border: "1px solid #3F4547",
                          }}
                        >
                          {combo.facilities}
                        </span>
                      ) : null}
                      {showStudioBadge ? (
                        <span
                          className="rounded px-2 py-0.5 text-xs"
                          style={{
                            background: "#2a2a2a",
                            color: "#868A8C",
                            border: "1px solid #3F4547",
                          }}
                        >
                          {combo.studio}
                        </span>
                      ) : null}
                      <span className="ml-auto text-xs text-pitch-accent">
                        {combo.requirements.length} role
                        {combo.requirements.length === 1 ? "" : "s"}
                      </span>
                      <span className="text-pitch-gray">{expanded ? "▼" : "▶"}</span>
                    </button>
                    {canEditDatabase ? (
                      <div className="flex flex-wrap gap-2 border-t border-[#2a2a2a] px-4 py-2">
                        <button
                          type="button"
                          className="text-xs text-pitch-accent underline-offset-2 hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditComboModal(combo);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="text-xs text-red-400 underline-offset-2 hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteComboTarget(combo);
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    ) : null}
                    {expanded ? (
                      <div className="border-t border-[#2a2a2a] px-4 py-3">
                        <div className="mb-2 text-xs text-pitch-gray">
                          Requirement rows linked to this package
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[520px] border-collapse text-sm">
                            <thead>
                              <tr className="border-b border-[#2a2a2a]">
                                <th className={DB_TH}>role_code</th>
                                <th className={DB_TH}>site</th>
                                <th className={`${DB_TH} text-right`}>
                                  qty
                                </th>
                                <th className={DB_TH}>coverage_type</th>
                              </tr>
                            </thead>
                            <tbody>
                              {combo.requirements.length === 0 ? (
                                <tr className={DB_TBODY_TR}>
                                  <td
                                    colSpan={4}
                                    className={`${DB_TD_EMPTY} py-3`}
                                  >
                                    No roles in this package
                                  </td>
                                </tr>
                              ) : (
                                combo.requirements.map((r) => (
                                  <tr key={r.id} className={DB_TBODY_TR}>
                                    <td className={DB_TD}>{r.roleCode}</td>
                                    <td className={DB_TD}>{r.site}</td>
                                    <td className={`${DB_TD} text-right`}>
                                      {r.quantity}
                                    </td>
                                    <td className={DB_TD}>
                                      {r.coverageType ?? "FREELANCE"}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </CollapsibleSection>

      <LookupValuesSection />
      <EventRulesSection />

      {isComboModalOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
          role="presentation"
          onClick={() => {
            if (!savingCombo) {
              setIsComboModalOpen(false);
              setEditingCombo(null);
              setComboFormError(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="combo-modal-title"
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg border p-5 shadow-xl"
            style={{
              background: "#111",
              borderColor: "#2a2a2a",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="combo-modal-title"
              className="text-lg font-semibold text-pitch-white"
            >
              {editingCombo ? "Edit standard" : "New standard"}
            </h2>
            {comboFormError ? (
              <p className="mt-3 rounded border border-red-900/50 bg-red-950/40 px-3 py-2 text-xs text-red-200">
                {comboFormError}
              </p>
            ) : null}
            <form className="mt-4 space-y-4" onSubmit={handleSubmitCombo}>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-pitch-accent">
                  Step 1 — Package header
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="combo-onsite"
                      className="mb-1 block text-xs text-pitch-gray"
                    >
                      Standard onsite <span className="text-red-400">*</span>
                    </label>
                    <input
                      id="combo-onsite"
                      type="text"
                      list="combo-onsite-datalist"
                      required
                      value={comboHeaderForm.standardOnsite}
                      onChange={(e) =>
                        setComboHeaderForm((v) => ({
                          ...v,
                          standardOnsite: e.target.value,
                        }))
                      }
                      className="w-full rounded border bg-[#1a1a1a] px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
                      style={{ borderColor: "#2a2a2a" }}
                    />
                    <datalist id="combo-onsite-datalist">
                      {comboHeaderDatalistOptions.onsite.map((v) => (
                        <option key={v} value={v} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label
                      htmlFor="combo-cologno"
                      className="mb-1 block text-xs text-pitch-gray"
                    >
                      Standard Cologno <span className="text-red-400">*</span>
                    </label>
                    <input
                      id="combo-cologno"
                      type="text"
                      list="combo-cologno-datalist"
                      required
                      value={comboHeaderForm.standardCologno}
                      onChange={(e) =>
                        setComboHeaderForm((v) => ({
                          ...v,
                          standardCologno: e.target.value,
                        }))
                      }
                      className="w-full rounded border bg-[#1a1a1a] px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
                      style={{ borderColor: "#2a2a2a" }}
                    />
                    <datalist id="combo-cologno-datalist">
                      {comboHeaderDatalistOptions.cologno.map((v) => (
                        <option key={v} value={v} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label
                      htmlFor="combo-facilities"
                      className="mb-1 block text-xs text-pitch-gray"
                    >
                      Facilities
                    </label>
                    <input
                      id="combo-facilities"
                      type="text"
                      list="combo-facilities-datalist"
                      value={comboHeaderForm.facilities}
                      onChange={(e) =>
                        setComboHeaderForm((v) => ({
                          ...v,
                          facilities: e.target.value,
                        }))
                      }
                      className="w-full rounded border bg-[#1a1a1a] px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
                      style={{ borderColor: "#2a2a2a" }}
                    />
                    <datalist id="combo-facilities-datalist">
                      {comboHeaderDatalistOptions.facilities.map((v) => (
                        <option key={v} value={v} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label
                      htmlFor="combo-studio"
                      className="mb-1 block text-xs text-pitch-gray"
                    >
                      Studio
                    </label>
                    <input
                      id="combo-studio"
                      type="text"
                      list="combo-studio-datalist"
                      value={comboHeaderForm.studio}
                      onChange={(e) =>
                        setComboHeaderForm((v) => ({
                          ...v,
                          studio: e.target.value,
                        }))
                      }
                      className="w-full rounded border bg-[#1a1a1a] px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
                      style={{ borderColor: "#2a2a2a" }}
                    />
                    <datalist id="combo-studio-datalist">
                      {comboHeaderDatalistOptions.studio.map((v) => (
                        <option key={v} value={v} />
                      ))}
                    </datalist>
                  </div>
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="combo-notes-h"
                      className="mb-1 block text-xs text-pitch-gray"
                    >
                      Package notes
                    </label>
                    <textarea
                      id="combo-notes-h"
                      rows={2}
                      value={comboHeaderForm.notes}
                      onChange={(e) =>
                        setComboHeaderForm((v) => ({
                          ...v,
                          notes: e.target.value,
                        }))
                      }
                      className="w-full resize-y rounded border bg-[#1a1a1a] px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
                      style={{ borderColor: "#2a2a2a" }}
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-pitch-accent">
                    Step 2 — Roles
                  </p>
                  <button
                    type="button"
                    className="rounded border px-2 py-1 text-xs text-pitch-gray-light hover:bg-[#1a1a1a] disabled:opacity-50"
                    style={{ borderColor: "#2a2a2a" }}
                    disabled={savingCombo}
                    onClick={() =>
                      setComboRoleRows((rows) => [...rows, newRoleRow()])
                    }
                  >
                    Add role
                  </button>
                </div>
                <div
                  className="overflow-x-auto rounded-lg border"
                  style={{ borderColor: "#2a2a2a" }}
                >
                  <table className="w-full min-w-[600px] border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#2a2a2a]">
                        <th className={DB_TH}>Role</th>
                        <th className={DB_TH}>Role location</th>
                        <th className={DB_TH}>Qty</th>
                        <th className={DB_TH}>Notes</th>
                        <th className={`${DB_TH} w-10`} />
                      </tr>
                    </thead>
                    <tbody>
                      {comboRoleRows.map((row) => (
                        <tr
                          key={row.rowId}
                          className={`${DB_TBODY_TR} align-top bg-[#1a1a1a]`}
                        >
                          <td className="px-3 py-3">
                            <select
                              value={
                                row.roleCode && row.roleLocation
                                  ? `${row.roleCode}__${row.roleLocation}`
                                  : ""
                              }
                              onChange={(e) => {
                                const v = e.target.value;
                                if (!v) {
                                  setComboRoleRows((prev) =>
                                    prev.map((r) =>
                                      r.rowId === row.rowId
                                        ? {
                                            ...r,
                                            roleCode: "",
                                            roleLocation: "STADIO",
                                          }
                                        : r
                                    )
                                  );
                                  return;
                                }
                                const [code, loc] = v.split("__");
                                setComboRoleRows((prev) =>
                                  prev.map((r) =>
                                    r.rowId === row.rowId
                                      ? {
                                          ...r,
                                          roleCode: code ?? "",
                                          roleLocation: (
                                            loc ?? "STADIO"
                                          ).toUpperCase(),
                                        }
                                      : r
                                  )
                                );
                              }}
                              className="w-full max-w-[220px] rounded border bg-[#111] px-1 py-1 text-pitch-white"
                              style={{ borderColor: "#2a2a2a" }}
                            >
                              <option value="">Select…</option>
                              {rolesSortedForSelect.map((r) => (
                                <option
                                  key={`${r.code}-${r.location}-${row.rowId}`}
                                  value={`${r.code}__${r.location}`}
                                >
                                  {r.name || r.code} ({r.location})
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-3">
                            <select
                              value={row.roleLocation}
                              onChange={(e) =>
                                setComboRoleRows((prev) =>
                                  prev.map((r) =>
                                    r.rowId === row.rowId
                                      ? {
                                          ...r,
                                          roleLocation: e.target.value,
                                        }
                                      : r
                                  )
                                )
                              }
                              className="w-full rounded border bg-[#111] px-1 py-1 text-pitch-white"
                              style={{ borderColor: "#2a2a2a" }}
                            >
                              {COMBO_ROLE_LOCATION_SORTED.map((loc) => (
                                <option key={loc} value={loc}>
                                  {loc}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-3">
                            <input
                              type="number"
                              min={1}
                              value={row.quantity}
                              onChange={(e) =>
                                setComboRoleRows((prev) =>
                                  prev.map((r) =>
                                    r.rowId === row.rowId
                                      ? { ...r, quantity: e.target.value }
                                      : r
                                  )
                                )
                              }
                              className="w-16 rounded border bg-[#111] px-1 py-1 text-pitch-white"
                              style={{ borderColor: "#2a2a2a" }}
                            />
                          </td>
                          <td className="px-3 py-3">
                            <textarea
                              rows={2}
                              value={row.notes}
                              onChange={(e) =>
                                setComboRoleRows((prev) =>
                                  prev.map((r) =>
                                    r.rowId === row.rowId
                                      ? { ...r, notes: e.target.value }
                                      : r
                                  )
                                )
                              }
                              className="w-full min-w-[100px] rounded border bg-[#111] px-1 py-1 text-pitch-white"
                              style={{ borderColor: "#2a2a2a" }}
                            />
                          </td>
                          <td className="px-3 py-3">
                            <button
                              type="button"
                              className="text-lg leading-none text-red-400 hover:text-red-300 disabled:opacity-40"
                              disabled={
                                savingCombo || comboRoleRows.length <= 1
                              }
                              title="Remove row"
                              aria-label="Remove row"
                              onClick={() =>
                                setComboRoleRows((prev) =>
                                  prev.length <= 1
                                    ? prev
                                    : prev.filter((r) => r.rowId !== row.rowId)
                                )
                              }
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="rounded border px-3 py-1.5 text-xs text-pitch-gray-light hover:bg-[#1a1a1a] disabled:opacity-50"
                  style={{ borderColor: "#2a2a2a" }}
                  disabled={savingCombo}
                  onClick={() => {
                    setIsComboModalOpen(false);
                    setEditingCombo(null);
                    setComboFormError(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={PRIMARY_BTN_SM}
                  disabled={savingCombo}
                >
                  {savingCombo ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {deleteComboTarget ? (
        <div
          className="fixed inset-0 z-[65] flex items-center justify-center bg-black/70 p-4"
          role="presentation"
          onClick={() => {
            if (!deletingCombo) setDeleteComboTarget(null);
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="del-combo-title"
            className="w-full max-w-md rounded-lg border p-5 shadow-xl"
            style={{
              background: "#111",
              borderColor: "#2a2a2a",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="del-combo-title"
              className="text-base font-semibold text-pitch-white"
            >
              Delete package
            </h2>
            <p className="mt-3 text-sm text-pitch-gray-light">
              Are you sure you want to delete this standard? All{" "}
              {deleteComboTarget.requirements.length} requirement rows will also be
              removed.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded border px-3 py-1.5 text-xs text-pitch-gray-light hover:bg-[#1a1a1a] disabled:opacity-50"
                style={{ borderColor: "#2a2a2a" }}
                disabled={deletingCombo}
                onClick={() => setDeleteComboTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-50"
                disabled={deletingCombo}
                onClick={() => void handleConfirmDeleteCombo()}
              >
                {deletingCombo ? "Deleting…" : "Delete"}
              </button>
            </div>
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
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-pitch-gray-dark bg-pitch-bg p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="staff-modal-title"
              className="text-lg font-semibold text-pitch-white"
            >
              {editingStaff ? "Edit staff" : "New staff"}
            </h2>
            {staffFormError ? (
              <p className="mt-3 rounded border border-red-900/50 bg-red-950/40 px-3 py-2 text-xs text-red-200">
                {staffFormError}
              </p>
            ) : null}
            <form className="mt-4 space-y-3" onSubmit={handleSubmitStaff}>
              <div>
                <p className="mb-2 border-b border-pitch-gray-dark pb-1 text-xs font-semibold uppercase text-pitch-gray">
                  Personal data
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label
                      htmlFor="staff-place-birth"
                      className="mb-1 block text-xs text-pitch-gray"
                    >
                      Place of birth
                    </label>
                    <input
                      id="staff-place-birth"
                      type="text"
                      value={staffFormValues.placeOfBirth}
                      onChange={(e) =>
                        setStaffFormValues((v) => ({
                          ...v,
                          placeOfBirth: e.target.value,
                        }))
                      }
                      className="w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="staff-date-birth"
                      className="mb-1 block text-xs text-pitch-gray"
                    >
                      Date of birth
                    </label>
                    <input
                      id="staff-date-birth"
                      type="date"
                      value={staffFormValues.dateOfBirth}
                      onChange={(e) =>
                        setStaffFormValues((v) => ({
                          ...v,
                          dateOfBirth: e.target.value,
                        }))
                      }
                      className="w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
                    />
                  </div>
                </div>
                <div className="mt-2">
                  <label
                    htmlFor="staff-address"
                    className="mb-1 block text-xs text-pitch-gray"
                  >
                    Residential address
                  </label>
                  <input
                    id="staff-address"
                    type="text"
                    value={staffFormValues.residentialAddress}
                    onChange={(e) =>
                      setStaffFormValues((v) => ({
                        ...v,
                        residentialAddress: e.target.value,
                      }))
                    }
                    className="w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
                  />
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <label
                      htmlFor="staff-id-number"
                      className="mb-1 block text-xs text-pitch-gray"
                    >
                      Document / ID
                    </label>
                    <input
                      id="staff-id-number"
                      type="text"
                      value={staffFormValues.idNumber}
                      onChange={(e) =>
                        setStaffFormValues((v) => ({
                          ...v,
                          idNumber: e.target.value,
                        }))
                      }
                      className="w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <p className="mb-2 border-b border-pitch-gray-dark pb-1 text-xs font-semibold uppercase text-pitch-gray">
                  Contract details
                </p>
                <div className="space-y-2">
                  <div>
                    <label
                      htmlFor="staff-extra-fee"
                      className="mb-1 block text-xs text-pitch-gray"
                    >
                      Extra fee
                    </label>
                    <input
                      id="staff-extra-fee"
                      type="text"
                      value={staffFormValues.extraFee}
                      onChange={(e) =>
                        setStaffFormValues((v) => ({
                          ...v,
                          extraFee: e.target.value,
                        }))
                      }
                      className="w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="staff-team-dazn"
                      className="mb-1 block text-xs text-pitch-gray"
                    >
                      DAZN Team
                    </label>
                    <input
                      id="staff-team-dazn"
                      type="text"
                      value={staffFormValues.teamDazn}
                      onChange={(e) =>
                        setStaffFormValues((v) => ({
                          ...v,
                          teamDazn: e.target.value,
                        }))
                      }
                      className="w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="staff-notes"
                      className="mb-1 block text-xs text-pitch-gray"
                    >
                      Notes
                    </label>
                    <textarea
                      id="staff-notes"
                      rows={3}
                      value={staffFormValues.staffNotes}
                      onChange={(e) =>
                        setStaffFormValues((v) => ({
                          ...v,
                          staffNotes: e.target.value,
                        }))
                      }
                      className="w-full resize-y rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <p className="mb-2 border-b border-pitch-gray-dark pb-1 text-xs font-semibold uppercase text-pitch-gray">
                  Settings
                </p>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-pitch-gray-light">
                  <input
                    id="staff-finance-visibility"
                    type="checkbox"
                    checked={staffFormValues.financeVisibility}
                    onChange={(e) =>
                      setStaffFormValues((v) => ({
                        ...v,
                        financeVisibility: e.target.checked,
                      }))
                    }
                    className="rounded border-pitch-gray-dark"
                  />
                  Financial visibility
                </label>
              </div>

              <div>
                <label
                  htmlFor="staff-surname"
                  className="mb-1 block text-xs text-pitch-gray"
                >
                  Last name <span className="text-red-400">*</span>
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
                  First name <span className="text-red-400">*</span>
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
                  Phone
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
                  Company
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
                  Default role <span className="text-red-400">*</span>
                </label>
                <select
                  id="staff-default-role"
                  required
                  value={staffDefaultRoleSelectValue}
                  onChange={(e) => {
                    const v = e.target.value;
                    setStaffFormValues((prev) => {
                      if (!v) {
                        return { ...prev, defaultRoleCode: "" };
                      }
                      const idx = v.indexOf("__");
                      const code = idx >= 0 ? v.slice(0, idx) : v;
                      const loc =
                        idx >= 0
                          ? v.slice(idx + 2).toUpperCase()
                          : prev.defaultLocation;
                      return {
                        ...prev,
                        defaultRoleCode: code,
                        defaultLocation:
                          idx >= 0 ? loc : prev.defaultLocation,
                      };
                    });
                  }}
                  className="w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
                >
                  <option value="">Select role…</option>
                  {!staffRolePairInCatalog && staffDefaultRoleSelectValue ? (
                    <option value={staffDefaultRoleSelectValue}>
                      {`${
                        effectiveRoleMap[staffFormValues.defaultRoleCode] ??
                        staffFormValues.defaultRoleCode
                      } (${staffFormValues.defaultLocation})`}
                    </option>
                  ) : null}
                  {rolesSortedForSelect.map((r) => (
                    <option
                      key={r.id}
                      value={`${r.code}__${r.location}`}
                    >
                      {r.name || r.code} ({r.location})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="staff-default-loc"
                  className="mb-1 block text-xs text-pitch-gray"
                >
                  Default location <span className="text-red-400">*</span>
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
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label
                    htmlFor="staff-plate-1"
                    className="mb-1 block text-xs text-pitch-gray"
                  >
                    Plate 1
                  </label>
                  <input
                    id="staff-plate-1"
                    type="text"
                    placeholder="AA000BB"
                    value={staffFormValues.plate1}
                    onChange={(e) =>
                      setStaffFormValues((v) => ({
                        ...v,
                        plate1: e.target.value,
                      }))
                    }
                    className="w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="staff-plate-2"
                    className="mb-1 block text-xs text-pitch-gray"
                  >
                    Plate 2
                  </label>
                  <input
                    id="staff-plate-2"
                    type="text"
                    placeholder="AA000BB"
                    value={staffFormValues.plate2}
                    onChange={(e) =>
                      setStaffFormValues((v) => ({
                        ...v,
                        plate2: e.target.value,
                      }))
                    }
                    className="w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="staff-plate-3"
                    className="mb-1 block text-xs text-pitch-gray"
                  >
                    Plate 3
                  </label>
                  <input
                    id="staff-plate-3"
                    type="text"
                    placeholder="AA000BB"
                    value={staffFormValues.plate3}
                    onChange={(e) =>
                      setStaffFormValues((v) => ({
                        ...v,
                        plate3: e.target.value,
                      }))
                    }
                    className="w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
                  />
                </div>
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
                Active
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
                  Cancel
                </button>
                <button
                  type="submit"
                  className={PRIMARY_BTN_SM}
                  disabled={savingStaff}
                >
                  {savingStaff ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
